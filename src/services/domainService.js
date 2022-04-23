/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable no-restricted-syntax */
const axios = require('axios');
const config = require('../../config/default');
const UdpBalancer = require('../lib/udp-balancer');
const log = require('../lib/log');

let balancers = [];

/**
 * [getApplicationIP Retrieves IP's that a given application is running on]
 * @param {string} appName [description]
 * @return {Array}         [description]
 */
async function getApplicationIP(appName) {
  try {
    const fluxnodeList = await axios.get(`https://api.runonflux.io/apps/location/${appName}`, { timeout: 13456 });
    if (fluxnodeList.data.status === 'success') {
      return fluxnodeList.data.data || [];
    }
    return [];
  } catch (e) {
    log.error(e);
    return [];
  }
}
/**
 * [start description]
 */
async function start() {
  try {
    for (let i = 0; i < config.apps.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const IPadresses = await getApplicationIP(config.apps[i].name);
      const options = {
        addresses: IPadresses,
        port: config.apps[i].port,
        consensusMin: config.apps[i].consensusMin,
        consensusTotal: config.apps[i].consensusTotal,
        ipv6: false,
        localaddress: '127.0.0.1',
        localport: config.apps[i].port,
        localipv6: false,
        proxyaddress: '0.0.0.0',
        timeOutTime: config.apps[i].timeout,
      };
      // This is the function that creates the loadbalancer, each connection is handled internally
      let balancer = UdpBalancer.createServer(options);
      balancer.on('listening', (details) => {
        console.log(`loadbalancer ready on ${details.server.family}  ${details.server.address}:${details.server.port}`);
        console.log(`traffic is forwarded to ${details.target.family}  ${details.target.address}:${details.target.port}`);
      });
      balancers.push(balancer);
    }
  } catch (e) {
    log.error(e);
  }
}
