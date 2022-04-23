const proxy = require('../src/lib/udp-balancer');

const options = {
  addresses: ['1.1.1.1', '8.8.8.8', '9.9.9.9', '149.112.112.112', '208.67.222.222'],
  port: 53,
  consensusMin: 2,
  consensusTotal: 3,
  ipv6: false,
  localaddress: '127.0.0.1',
  localport: 53535,
  localipv6: false,
  proxyaddress: '0.0.0.0',
  timeOutTime: 10000,
};

// This is the function that creates the server, each connection is handled internally
const server = proxy.createServer(options);

// this should be obvious
server.on('listening', (details) => {
  console.log(`udp-proxy-server ready on ${details.server.family}  ${details.server.address}:${details.server.port}`);
  console.log(`traffic is forwarded to ${details.target.family}  ${details.target.address}:${details.target.port}`);
});

// 'bound' means the connection to server has been made and the proxying is in action
server.on('bound', (details) => {
  console.log(`proxy is bound to ${details.route.address}:${details.route.port}`);
  console.log(`peer is bound to ${details.peer.address}:${details.peer.port}`);
});

// 'message' is emitted when the server gets a message
server.on('message', (message, sender) => {
  console.log(`message from ${sender.address}:${sender.port}`);
});

// 'proxyMsg' is emitted when the bound socket gets a message and it's send back to the peer the socket was bound to
server.on('proxyMsg', (message, sender, peer) => {
  console.log(`answer from ${sender.address}:${sender.port} peer ${peer.address}:${peer.port}`);
});

// 'proxyClose' is emitted when the socket closes (from a timeout) without new messages
server.on('proxyClose', (peer) => {
  console.log(`disconnecting socket from ${peer.address}`);
});

server.on('proxyError', (err) => {
  console.log(`ProxyError! ${err}`);
});

server.on('error', (err) => {
  console.log(`Error! ${err}`);
});
