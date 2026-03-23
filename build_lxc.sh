#!/bin/bash

# ==========================================================================================
# County Scribe - Proxmox LXC Auto-Installer (Debian 13)
# ==========================================================================================
# Run this on your Proxmox Host.
# It creates a Debian 13 LXC with Docker and GPU Passthrough for County Scribe.
# ==========================================================================================

set -e

# Colors for UI
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  ____                  _         ____            _ _           "
echo " / ___|___  _   _ _ __ | |_ _   _/ ___|  ___ _ __(_) |__   ___ "
echo "| |   / _ \| | | | '_ \| __| | | \___ \ / __| '__| | '_ \ / _ \\"
echo "| |__| (_) | |_| | | | | |_| |_| |___) | (__| |  | | |_) |  __/"
echo " \____\___/ \__,_|_| |_|\__|\__, |____/ \___|_|  |_|_.__/ \___|"
echo "                            |___/                              "
echo -e "${NC}"

# --- 1. Gather Info ---
# These can be pre-set by a wrapper like install_proxmox.sh
NEXT_ID=$(pvesh get /cluster/nextid)
CT_ID=${CT_ID:-$NEXT_ID}
CT_HOSTNAME=${CT_HOSTNAME:-"county-scribe"}
CT_STORAGE=${CT_STORAGE:-"local-lvm"}

# If no password provided, ask (if not already set in environment)
if [ -z "$CT_PASSWORD" ]; then
    read -s -p "Enter Root Password: " CT_PASSWORD
    echo ""
fi

# --- 2. Check/Download Template ---
echo -e "\n${YELLOW}[Step 1/5] Preparing Debian 13 Template...${NC}"
pveam update
TEMPLATE=$(pveam available --section system | grep "debian-13" | head -n1 | awk '{print $2}')

if [ -z "$TEMPLATE" ]; then
    echo -e "${RED}Error: Debian 13 template not found in repositories.${NC}"
    exit 1
fi

TEMPLATE_STORAGE=$(pvesm status | grep "dir" | head -n1 | awk '{print $1}')
if [ -z "$TEMPLATE_STORAGE" ]; then TEMPLATE_STORAGE="local"; fi

echo -e "Downloading $TEMPLATE to $TEMPLATE_STORAGE..."
pveam download $TEMPLATE_STORAGE $TEMPLATE
CT_TEMPLATE="$TEMPLATE_STORAGE:vztmpl/$(basename $TEMPLATE)"

# --- 3. Create Container ---
echo -e "\n${YELLOW}[Step 2/5] Creating LXC Container $CT_ID...${NC}"
pct create $CT_ID "$CT_TEMPLATE" \
    --hostname $CT_HOSTNAME \
    --password $CT_PASSWORD \
    --storage $CT_STORAGE \
    --memory 8192 \
    --cores 4 \
    --rootfs $CT_STORAGE:40 \
    --net0 name=eth0,bridge=vmbr0,ip=dhcp \
    --unprivileged 0 \
    --features nesting=1 \
    --onboot 1

# --- 4. GPU Passthrough Injection ---
echo -e "\n${YELLOW}[Step 3/5] Configuring GPU Passthrough...${NC}"
CONF_FILE="/etc/pve/lxc/$CT_ID.conf"

# Detect Nvidia Major/Minor
NV_CTL_MAJOR=$(ls -l /dev/nvidiactl | awk '{print $5}' | cut -d, -f1)
NV_UVM_MAJOR=$(ls -l /dev/nvidia-uvm | awk '{print $5}' | cut -d, -f1)

cat <<EOF >> $CONF_FILE
# --- GPU PASSTHROUGH ---
lxc.cgroup2.devices.allow: c $NV_CTL_MAJOR:* rwm
lxc.cgroup2.devices.allow: c $NV_UVM_MAJOR:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
EOF

echo -e "${GREEN}Passthrough configured using device major IDs $NV_CTL_MAJOR and $NV_UVM_MAJOR.${NC}"

# --- 5. Start and Deploy ---
echo -e "\n${YELLOW}[Step 4/5] Starting Container...${NC}"
pct start $CT_ID
echo "Waiting for network (10s)..."
sleep 10

echo -e "\n${YELLOW}[Step 5/5] Installing Docker and Software...${NC}"

# Create the setup script to run INSIDE the LXC
cat <<'EOF_INTERNAL' > /tmp/lxc_setup.sh
#!/bin/bash
set -e
apt-get update
apt-get install -y curl git sudo gnupg apt-transport-https ca-certificates

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update
apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

mkdir -p /opt/county-scribe
EOF_INTERNAL

pct cp $CT_ID /tmp/lxc_setup.sh /root/setup.sh
pct exec $CT_ID -- bash /root/setup.sh

# --- 6. Final Code Injection (The "County Scribe" part) ---
echo -e "\n${GREEN}Injecting County Scribe Source Code...${NC}"

# Since we are running this from the cloned repo root
SRC_DIR="."

echo "Found source files in $SRC_DIR. Copying..."
pct exec $CT_ID -- mkdir -p /opt/county-scribe/backend /opt/county-scribe/frontend /opt/county-scribe/uploads /opt/county-scribe/archive

# Copy source files (cloned from GitHub)
# In the GitHub repo, backend/ and frontend/ are in the root
tar -cf - -C "$SRC_DIR" backend | pct exec $CT_ID -- tar -xf - -C /opt/county-scribe --strip-components=1
tar -cf - -C "$SRC_DIR" frontend | pct exec $CT_ID -- tar -xf - -C /opt/county-scribe --strip-components=1

# Override/Ensure LXC-specific files are used (they are in the root of the repo)
pct cp $CT_ID "$SRC_DIR/Dockerfile" /opt/county-scribe/backend/Dockerfile
pct cp $CT_ID "$SRC_DIR/requirements.txt" /opt/county-scribe/backend/requirements.txt
pct cp $CT_ID "$SRC_DIR/main.py" /opt/county-scribe/backend/main.py
pct cp $CT_ID "$SRC_DIR/App.js" /opt/county-scribe/frontend/src/App.js

# Copy root files
if [ -f "$SRC_DIR/docker-compose.yml" ]; then
    pct cp $CT_ID "$SRC_DIR/docker-compose.yml" /opt/county-scribe/docker-compose.yml
fi

echo -e "${YELLOW}Building Docker Image (This will take ~10 minutes)...${NC}"
pct exec $CT_ID -- bash -c "cd /opt/county-scribe && docker compose up -d --build"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "  County Scribe is now installed in LXC $CT_ID!"
echo -e "  Access it at: http://$(pct exec $CT_ID -- hostname -I | awk '{print $1}'):8000"
echo -e "======================================================${NC}"
