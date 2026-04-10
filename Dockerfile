# Simple robust Dockerfile for Finance
FROM node:22-alpine
WORKDIR /app
COPY .env ./
COPY kalles-finance/package*.json ./kalles-finance/
COPY kalles-traffic/package*.json ./kalles-traffic/
RUN cd kalles-finance && npm install --legacy-peer-deps
COPY kalles-finance ./kalles-finance
COPY kalles-traffic ./kalles-traffic
WORKDIR /app/kalles-finance

CMD ["npx", "ts-node", "src/index.ts"]
