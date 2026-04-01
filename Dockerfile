FROM node:22-alpine

WORKDIR /app

# Copy root environment and config if needed
COPY .env ./

# Install dependencies for the specific service
WORKDIR /app/kalles-finance
COPY kalles-finance/package*.json ./
RUN npm install --legacy-peer-deps

# Copy the entire monorepo so cross-repo relative imports work
WORKDIR /app
COPY kalles-finance ./kalles-finance
COPY kalles-traffic ./kalles-traffic

WORKDIR /app/kalles-finance
CMD ["npm", "start"]
