FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git python3 make g++ 

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Set default command (can be overridden)
CMD ["npx", "hardhat", "node"]