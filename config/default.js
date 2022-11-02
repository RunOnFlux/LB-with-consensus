module.exports = {
  apps: [
    {
      appName: 'pdns',
      port: 53,
      containerPort: 30053,
      protocol: 'udp',
      consensusMin: 2,
      consensusTotal: 3,
      timeout: 5000,
    },
  ],
};
