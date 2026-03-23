#!/bin/bash

echo "=========================================="
echo "Starting County Scribe (Universal Docker)"
echo "=========================================="

# Check for docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed. Please install Docker first."
    exit 1
fi

echo ""
echo "Launching County Scribe Docker containers..."
# Try running with docker compose plugin first, fallback to older docker-compose
if docker compose version &> /dev/null; then
    sudo docker compose up -d --build
else
    sudo docker-compose up -d --build
fi

echo ""
echo "=========================================="
echo "SUCCESS: County Scribe is now running in the background!"
echo "Open your web browser and navigate to:"
echo "http://localhost:8000"
echo ""
echo "Note: It may take a minute or two for the AI models to load on the first run."
echo "=========================================="
