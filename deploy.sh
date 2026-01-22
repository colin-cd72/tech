#!/bin/bash
# Deploy script for TGL Tech Schedule
# Called by GitHub webhook on push to master

set -e

APP_DIR="/home/cloudpanel/htdocs/tech.4tmrw.net"
LOG_FILE="$APP_DIR/logs/deploy.log"

echo "$(date): Starting deploy..." >> $LOG_FILE

cd $APP_DIR

# Pull latest changes
echo "$(date): Pulling from git..." >> $LOG_FILE
git pull origin master >> $LOG_FILE 2>&1

# Install backend dependencies
echo "$(date): Installing backend dependencies..." >> $LOG_FILE
cd backend
npm install --production >> $LOG_FILE 2>&1

# Run migrations
echo "$(date): Running migrations..." >> $LOG_FILE
npm run migrate >> $LOG_FILE 2>&1

# Build frontend
echo "$(date): Building frontend..." >> $LOG_FILE
cd ../frontend
npm install >> $LOG_FILE 2>&1
npm run build >> $LOG_FILE 2>&1

# Copy frontend build to serve directory (if using static serving)
# cp -r dist/* ../backend/public/

# Restart backend with PM2
echo "$(date): Restarting PM2..." >> $LOG_FILE
cd $APP_DIR
pm2 restart schedule-backend >> $LOG_FILE 2>&1

echo "$(date): Deploy complete!" >> $LOG_FILE
