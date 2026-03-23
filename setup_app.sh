#!/usr/bin/env bash

# ==========================================================================================
# County Scribe - Humble Container Provisioning
# ==========================================================================================

set -e

# --- 0. Locale Setup ---
# Set non-interactive mode for automated installation
export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C.UTF-8
export LANG=en_US.UTF-8

echo "------------------------------------------------------------"
echo "🏯  County Scribe: Installation Configuration"
echo "------------------------------------------------------------"

# --- 1. Base Dependencies ---
echo "📦  Installing base system dependencies..."
apt-get update &>/dev/null
apt-get install -y locales &>/dev/null
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
locale-gen &>/dev/null

apt-get install -y curl git sudo gnupg apt-transport-https ca-certificates &>/dev/null

# --- 2. Install Docker ---
if ! command -v docker &> /dev/null; then
    echo "🐳  Installing Docker runtime environment..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh &>/dev/null
fi

# --- 3. Install NVIDIA Container Toolkit ---
echo "🚀  Configuring NVIDIA Container Toolkit for AI acceleration..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list &>/dev/null
apt-get update &>/dev/null
apt-get install -y nvidia-container-toolkit &>/dev/null
nvidia-ctk runtime configure --runtime=docker &>/dev/null
systemctl restart docker

# --- 4. Deploy County Scribe ---
echo "📜  Fetching latest application source code..."
mkdir -p /opt/county-scribe
if [ -d "/opt/county-scribe/.git" ]; then
    cd /opt/county-scribe && git pull &>/dev/null
else
    git clone https://github.com/cookiescgov/Countryscribe-Github /opt/county-scribe &>/dev/null
fi

cd /opt/county-scribe
echo "🏗️  Building Docker containers. This process may take a few moments..."
docker compose up -d --build

echo "✅  County Scribe is now operational."
echo "------------------------------------------------------------"
