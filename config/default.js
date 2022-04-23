module.exports = {
  apps: [
    {
      name: 'pdns',
      port: 53,
      protocol: 'udp',
      consensusMin: 2,
      consensusTotal: 3,
      timeout: 5000,
    },
  ],
};
