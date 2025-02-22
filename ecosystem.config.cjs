module.exports = {
  apps: [
    {
      script: "index.js",
      watch: true,
      ignore_watch: ["node_modules", "README.md"],
      autorestart: true,
    },
  ],
};
