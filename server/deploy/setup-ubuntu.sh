#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash server/deploy/setup-ubuntu.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg git nginx postgresql postgresql-contrib certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'Number(process.versions.node.split(\".\")[0])')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

mkdir -p /var/www
systemctl enable nginx
systemctl enable postgresql

echo "Base packages are ready."
echo "Next: clone the repo to /var/www/pictool, configure server/.env, run migrations, then start PM2."
