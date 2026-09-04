FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy rest of the app
COPY . .

# Copy the test env file as default .env
COPY .env.production .env

# Build using the test environment
RUN npx dotenv -e .env.production -- npx cross-env NEXT_PUBLIC_ENV=production npm run build:prod

# Expose default Next.js port
EXPOSE 3000

# Install curl for health check
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Run using the test env again at runtime
CMD ["sh", "-c", "npx dotenv -e .env.production -- npx cross-env NEXT_PUBLIC_ENV=production npm run start"]
