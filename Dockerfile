# Stage 1: Solidity compiler
FROM ethereum/solc:stable as build-deps

# Stage 2: Main application
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy solc from build-deps stage
COPY --from=build-deps /usr/bin/solc /usr/bin/solc

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Set default command (can be overridden)
CMD ["npx", "hardhat", "node"]