module.exports = {
  apps: [
    {
      name: 'icon-server',
      script: 'node_modules/ts-node/dist/bin.js',
      args: 'src/server.ts',
      interpreter: 'none',
      watch: ['src'],
      env: {
        NODE_ENV: 'development',
        PORT: '3000'
      }
    }
  ]
};