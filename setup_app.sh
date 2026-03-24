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
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --batch --yes --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list &>/dev/null
apt-get update &>/dev/null
apt-get install -y nvidia-container-toolkit &>/dev/null
nvidia-ctk runtime configure --runtime=docker &>/dev/null

# --- FIX: Unprivileged LXC Cgroup BPF Error ---
# This prevents the "nvidia-container-cli: mount error: bpf_prog_query failed: operation not permitted"
nvidia-ctk config --set nvidia-container-cli.no-cgroups=true --in-place &>/dev/null

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

# --- Hardware Detection & GPU Override ---
if command -v nvidia-smi &> /dev/null && nvidia-smi &> /dev/null; then
    echo "🎮  GPU Hardware Detected! Enabling Hardware Acceleration for Docker..."
    cat <<EOF > docker-compose.override.yml
services:
  county-scribe:
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
EOF
else
    echo "⚠️  No valid GPU bindings detected inside LXC. Engaging CPU Fallback mode..."
    rm -f docker-compose.override.yml
fi

echo "🏗️  Building Docker containers. This process may take a few moments..."

# Determine User's Preferred Logging Style
DOCKER_STYLE=$(cat /tmp/docker_style.txt 2>/dev/null || echo "default")

if [ "$DOCKER_STYLE" == "verbose" ]; then
    echo "💡 Using verbose plain-text logger..."
    BUILDKIT_PROGRESS=plain docker compose up -d --build
else
    docker compose up -d --build
fi

# Inject Global Update Shortcut inside LXC
cat <<'EOF' > /usr/local/bin/update
#!/bin/bash
echo "=========================================="
echo "Updating Operating System (apt upgrade)..."
echo "=========================================="
apt-get update && apt-get upgrade -y

echo "=========================================="
echo "Updating County Scribe Application Code..."
echo "=========================================="
cd /opt/county-scribe || exit
git pull
bash setup_app.sh
echo "✅ Full System Update Complete!"
EOF
chmod +x /usr/local/bin/update

echo "✅  County Scribe is now operational."
echo "💡  Pro Tip: You can type 'update' at any time in this console to pull the latest changes!"
echo "------------------------------------------------------------"
