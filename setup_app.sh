#!/usr/bin/env bash

# ==========================================================================================
# County Scribe - Container Setup Script
# ==========================================================================================

set -e

# --- 1. Base Dependencies ---
apt-get update
apt-get install -y curl git sudo gnupg apt-transport-https ca-certificates

# --- 2. Install Docker ---
if ! command -v docker &> /dev/null; then
    echo "Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# --- 3. Install NVIDIA Container Toolkit ---
echo "Installing NVIDIA Container Toolkit..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update
apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# --- 4. Deploy County Scribe ---
echo "Cloning County Scribe..."
mkdir -p /opt/county-scribe
git clone https://github.com/cookiescgov/Countryscribe-Github /opt/county-scribe

cd /opt/county-scribe
# Ensure Docker Compose is up and running
docker compose up -d --build

echo "Container setup complete."
