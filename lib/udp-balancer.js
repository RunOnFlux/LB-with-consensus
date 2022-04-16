/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-vars */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-shadow */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-restricted-syntax */
const dgram = require('dgram');
const events = require('events');
const util = require('util');
const net = require('net');
const Packet = require('./Packet');

/**
 * [UdpBalancer description]
 */
class UdpBalancer {
  constructor(options) {
    const proxy = this;
    let localUdpType = 'udp4';
    const serverPort = options.localport || 0;
    let serverHost = options.localaddress || '0.0.0.0';
    let proxyHost = options.proxyaddress || '0.0.0.0';
    this.tOutTime = options.timeOutTime || 2000;
    this.family = 'IPv4';
    this.udpType = 'udp4';
    this.consensusMin = options.consensusMin;
    this.consensusTotal = options.consensusTotal;
    this.host = options.addresses || 'localhost';
    this.port = options.port || 41234;
    this.connections = {};
    this.replies = {};

    if (options.ipv6) {
      this.udpType = 'udp6';
      this.family = 'IPv6';
      proxyHost = net.isIPv6(options.proxyaddress) ? options.proxyaddress : '::0';
    }
    this.details = {
      target: {
        address: this.host,
        family: this.family,
        port: this.port,
        currentTarget: -1,
      },
    };
    this.detailKeys = Object.keys(this.details);
    if (options.localipv6) {
      localUdpType = 'udp6';
      serverHost = net.isIPv6(options.localaddress) ? options.localaddress : '::0';
    }
    this.middleware = options.middleware;
    this.server = dgram.createSocket(localUdpType);
    this.server.on('listening', function () {
      const details = proxy.getDetails({ server: this.address() });
      setImmediate(() => {
        proxy.emit('listening', details);
      });
    }).on('message', (msg, sender) => {
      const client = proxy.createClient(msg, sender);
      if (!client.bound) { client.bind(0, proxyHost); } else { client.emit('send', msg, sender); }
    }).on('error', function (err) {
      this.close();
      proxy.emit('error', err);
    }).on('close', () => {
      proxy.emit('close');
    })
      .bind(serverPort, serverHost);
    setInterval(this.internalGC.bind(this), 60 * 1000);
  }

  /**
     * [getNextTarget description]
     * @return {[type]}        [description]
     */
  getNextTarget() {
    // eslint-disable-next-line no-plusplus
    this.details.target.currentTarget++;
    if (this.details.target.currentTarget === this.details.target.address.length) this.details.target.currentTarget = 0;
    return this.details.target.address[this.details.target.currentTarget];
  }

  /**
     * [internalGC description]
     */
  internalGC() {
    let removed = 0;
    for (const key in this.replies) {
      // eslint-disable-next-line no-prototype-builtins
      if (this.replies.hasOwnProperty(key)) {
        if (this.replies[key].time > Date.now() + 5000) {
          delete this.replies[key];
          removed++;
        }
      }
    }
    console.log(`GC running, removed keys: ${removed}`);
  }

  /**
     * [getDetails description]
     * @param {[type]} initialObj [description]
     * @return {[type]}        [description]
     */
  getDetails(initialObj) {
    const self = this;
    return this.detailKeys.reduce((obj, key) => {
      // eslint-disable-next-line no-param-reassign
      obj[key] = self.details[key];
      return obj;
    }, initialObj);
  }

  /**
     * [hashD description]
     * @param {[type]} address [description]
     * @return {[type]}        [description]
     */
  hashD(address) {
    return (address.address + address.port).replace(/\./g, '');
  }

  /**
     * [send description]
     * @param {[type]} msg [description]
     * @param {[type]} port [description]
     * @param {[type]} address [description]
     * @param {[type]} callback [description]
     */
  send(msg, port, address, callback) {
    this.server.send(msg, 0, msg.length, port, address, callback);
  }

  /**
     * [createClient description]
     * @param {[type]} msg [description]
     * @param {[type]} sender [description]
     * @return {[type]}        [description]
     */
  createClient(msg, sender) {
    const senderD = this.hashD(sender);
    const proxy = this;
    let client;
    if (this.connections.hasOwnProperty(senderD)) {
      client = this.connections[senderD];
      clearTimeout(client.t);
      client.t = null;
      return client;
    }
    client = dgram.createSocket(this.udpType);
    client.once('listening', function () {
      const details = proxy.getDetails({ route: this.address(), peer: sender });
      this.peer = sender;
      this.bound = true;
      proxy.emit('bound', details);
      this.emit('send', msg, sender);
    }).on('message', function (msg, sender) {
      if (proxy.middleware) {
        const self = this;
        proxy.middleware.proxyMsg(msg, sender, this.peer, (msg, sender, peer) => {
          proxy.handleProxyMsg(self, proxy, msg, sender, peer);
        });
      } else {
        proxy.handleProxyMsg(this, proxy, msg, sender, this.peer);
      }
    }).on('close', function () {
      proxy.emit('proxyClose', this.peer);
      this.removeAllListeners();
      delete proxy.connections[senderD];
    }).on('error', function (err) {
      this.close();
      proxy.emit('proxyError', err);
    })
      .on('send', function (msg, sender) {
        if (proxy.middleware) {
          const self = this;
          proxy.middleware.message(msg, sender, (msg, sender) => {
            proxy.handleMessage(self, proxy, msg, sender);
          });
        } else {
          proxy.handleMessage(this, proxy, msg, sender);
        }
      });
    this.connections[senderD] = client;
    return client;
  }

  /**
     * [handleProxyMsg description]
     * @param {[type]} socket [description]
     * @param {[type]} proxy [description]
     * @param {[type]} msg [description]
     * @param {[type]} sender [description]
     * @param {[type]} peer [description]
     */
  handleProxyMsg(socket, proxy, msg, sender, peer) {
    console.log(`asnwer from ${sender.address}`);
    const response = Packet.parse(msg);
    if (proxy.replies.hasOwnProperty(peer.address + peer.port)) {
      if (proxy.replies[peer.address + peer.port].msg === response.answers[0].address) { proxy.replies[peer.address + peer.port].replies++; }
      if (proxy.replies[peer.address + peer.port].replies === proxy.consensusMin) {
        proxy.send(msg, peer.port, peer.address, (err, bytes) => {
          if (err) { socket.emit('proxyError', err); }
        });
        proxy.emit('proxyMsg', msg, sender, peer);
        delete proxy.replies[peer.address + peer.port];
        socket.close();
      }
    } else { // first answer
      proxy.replies[peer.address + peer.port] = { msg: response.answers[0].address, replies: 1, time: Date.now() };
      if (proxy.consensusMin === 1) {
        proxy.send(msg, peer.port, peer.address, (err, bytes) => {
          if (err) { socket.emit('proxyError', err); }
        });
        proxy.emit('proxyMsg', msg, sender, peer);
        delete proxy.replies[peer.address + peer.port];
      }
    }

    console.log(JSON.stringify(proxy.replies));
  }

  /**
     * [handleMessage description]
     * @param {[type]} socket [description]
     * @param {[type]} proxy [description]
     * @param {[type]} msg [description]
     * @param {[type]} sender [description]
     */
  handleMessage(socket, proxy, msg, sender) {
    proxy.emit('message', msg, sender);
    for (let i = 0; i < proxy.consensusTotal; i++) {
      const target = proxy.getNextTarget();
      console.log(`forwarding to ${target}`);
      socket.send(msg, 0, msg.length, proxy.port, target, (err, bytes) => {
        if (err) { proxy.emit('proxyError', err); }
        if (!socket.t) {
          socket.t = setTimeout(() => {
            try {
              socket.close();
            // eslint-disable-next-line no-empty
            } catch (e) { }
          }, proxy.tOutTime);
        }
      });
    }
  }

  /**
     * [close description]
     * @param {[type]} callback [description]
     */
  close(callback) {
    // close clients
    const proxyConnections = this.connections;
    Object.keys(proxyConnections).forEach((senderD) => {
      const client = proxyConnections[senderD];
      if (client.t) {
        clearTimeout(client.t);
        client.t = null;
        client.close();
      }
    });
    this.connections = {};
    try {
      this.server.close(callback || (() => { }));
    // eslint-disable-next-line no-empty
    } catch (e) { }
  }
}

util.inherits(UdpBalancer, events.EventEmitter);

exports.createServer = function (options) {
  return new UdpBalancer(options);
};
