module.exports = {
  apps: [
    {
      name: 'SMART-PACKING-DEMO-V2',
      script: 'yarn start',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
    },
  ],
};