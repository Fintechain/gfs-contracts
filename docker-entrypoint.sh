#!/bin/sh
set -e

if [ "$1" = "node" ]; then
  echo "Starting Hardhat node..."
  exec npx hardhat node
elif [ "$1" = "deploy" ]; then
  echo "Running deployment script..."
  exec npx hardhat deploy --network localhost
else
  echo "Running tests..."
  exec "$@"
fi
