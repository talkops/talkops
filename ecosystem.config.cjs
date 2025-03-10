module.exports = {
  apps: [
    {
      script: 'index.mjs',
      watch: true,
      ignore_watch: ['node_modules', 'README.md'],
      autorestart: true,
    },
  ],
}
