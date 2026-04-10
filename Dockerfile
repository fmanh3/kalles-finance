# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY .env ./
WORKDIR /app/kalles-finance
COPY kalles-finance/package*.json ./
RUN npm install --legacy-peer-deps
WORKDIR /app
COPY kalles-finance ./kalles-finance
COPY kalles-traffic ./kalles-traffic
WORKDIR /app/kalles-finance
RUN npx tsc

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app/kalles-finance
COPY kalles-finance/package*.json ./
RUN npm install --only=production --legacy-peer-deps
# Kopiera hela dist-strukturen
COPY --from=build /app/kalles-finance/dist ./dist
COPY kalles-finance/knexfile.ts ./
# Den exakta sökvägen från felmeddelandet (relativt WORKDIR /app/kalles-finance)
CMD ["node", "dist/kalles-buss/kalles-finance/src/index.js"]
