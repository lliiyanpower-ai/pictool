"use strict";

module.exports = {
  apps: [
    {
      name: "pictool-analytics",
      script: "src/app.js",
      cwd: "/var/www/pictool/server",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "300M",
      time: true
    }
  ]
};
