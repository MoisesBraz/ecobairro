FROM node:20-alpine

# Install docker CLI so we can spawn planetiler container using the host's docker daemon
RUN apk add --no-cache docker-cli

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/

# Install ts-node or run via npx tsx
RUN npm install -g tsx

# We will mount the host docker socket to /var/run/docker.sock when running this
# We also expect the data directory to be mounted to /data
CMD ["tsx", "src/index.ts"]
