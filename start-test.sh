#!/bin/bash

# start-test.sh
set -e

# Clean up any existing containers
echo "Cleaning up existing containers..."
docker compose down --remove-orphans

# Start services in the background and wait for them
echo "Starting services..."
docker compose up -d ganache geth

# Function to check container health
check_container_health() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for $container to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if [ "$(docker inspect --format='{{.State.Health.Status}}' $container)" = "healthy" ]; then
            echo "$container is healthy!"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $container not healthy yet, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "$container failed to become healthy after $max_attempts attempts"
    docker compose logs $container
    return 1
}

# Wait for containers to be healthy
check_container_health ganache || exit 1
check_container_health geth || exit 1

# Run the tests
echo "Running integration tests..."
docker compose run --rm hardhat npm run test:ganache:integration

# Clean up
echo "Cleaning up..."
docker compose down --remove-orphans