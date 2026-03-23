#!/usr/bin/env bash

# ==========================================================================================
# 🏛️  County Scribe (郡書記)
# Created with Care by: Luke Cook, Starke County Government IT Department
# ==========================================================================================

set -e

# --- UI Helper Functions ---
function msg_box() {
    whiptail --title "County Scribe (郡書記)" --msgbox "$1" 12 70
}

function ask_yesno() {
    whiptail --title "County Scribe (郡書記)" --yesno "$1" 12 70
}

function get_input() {
    whiptail --title "County Scribe (郡書記)" --inputbox "$1" 12 70 "$2" 3>&1 1>&2 2>&3
}

function get_password() {
    whiptail --title "County Scribe (郡書記)" --passwordbox "$1" 12 70 3>&1 1>&2 2>&3
}

# --- 1. Welcome & Introduction ---
clear
cat <<EOF
   ______                            _____            _ _          
  / ____/___  __  ______  dH_ __  / ___/__________(_) |__  ___  
 / /   / __ \/ / / / __ \/ __/ / / \__ \/ ___/ ___/ / '_ \/ _ \ 
/ /___/ /_/ / /_/ / / / / /_/ /_/ /___/ / /__/ /  / / /_) /  __/ 
\____/\____/\__,_/_/ /_/\__/\__, /____/\___/_/  /_/_.__/\___/  
                           /____/                             
     Created by: Luke Cook | Starke County Government IT
EOF

if ! ask_yesno "Welcome to the County Scribe installation service.\n\nWe are honored to assist you with this deployment.\n\nWould you be so kind as to proceed with the installation?"; then
    echo "We most humbly respect your decision. Installation cancelled."
    exit 0
fi

# --- 2. Gather Configuration ---
NEXT_ID=$(pvesh get /cluster/nextid)
CT_ID=$(get_input "Please provide the desired Container ID for your new Scribe:" "$NEXT_ID")
CT_HOSTNAME=$(get_input "Please provide a hostname (DNS friendly):" "county-scribe")
CT_PASSWORD=$(get_password "Please provide a secure root password:")

STORAGE_LIST=$(pvesm status | grep -E "dir|lvm|zfspool" | awk '{print $1 " " $2}' | xargs)
CT_STORAGE=$(whiptail --title "County Scribe (郡書記)" --menu "Please select the storage for the container:" 15 70 6 $(echo $STORAGE_LIST) 3>&1 1>&2 2>&3)

CT_CORES=$(get_input "How many CPU cores may we allocate?" "4")
CT_RAM=$(get_input "How many MiB of RAM?" "8192")
CT_DISK=$(get_input "How many GB of disk space?" "40")

# --- 3. Host Preparation ---
echo "We are most humbly preparing the host environment..."
if ! command -v git &> /dev/null; then
    apt-get update && apt-get install -y git &>/dev/null
fi

# --- 4. Download Template ---
echo "We are gracefully retrieving the Debian 13 template..."
pveam update &>/dev/null
TEMPLATE=$(pveam available --section system | grep "debian-13" | head -n1 | awk '{print $2}')
pveam download local "$TEMPLATE" &>/dev/null

# --- 5. Container Creation ---
echo "We are carefully constructing the LXC container $CT_ID..."
pct create "$CT_ID" "local:vztmpl/$(basename $TEMPLATE)" \
    --hostname "$CT_HOSTNAME" \
    --password "$CT_PASSWORD" \
    --storage "$CT_STORAGE" \
    --memory "$CT_RAM" \
    --cores "$CT_CORES" \
    --rootfs "$CT_STORAGE:$CT_DISK" \
    --net0 name=eth0,bridge=vmbr0,ip=dhcp \
    --unprivileged 0 \
    --features nesting=1 \
    --onboot 1 \
    --timezone host

# --- 6. GPU Passthrough Configuration (Polite Error Handling) ---
echo "We are humbly mapping the NVIDIA GPU pathways..."
CONF_FILE="/etc/pve/lxc/$CT_ID.conf"

# Detect IDs with fallbacks
if [ -e /dev/nvidiactl ]; then
    NV_CTL_MAJOR=$(ls -l /dev/nvidiactl | awk '{print $5}' | cut -d, -f1)
else
    echo "⚠️ We apologize, but /dev/nvidiactl was not found. Using fallback ID (195)."
    NV_CTL_MAJOR="195"
fi

if [ -e /dev/nvidia-uvm ]; then
    NV_UVM_MAJOR=$(ls -l /dev/nvidia-uvm | awk '{print $5}' | cut -d, -f1)
else
    echo "⚠️ We apologize, but /dev/nvidia-uvm was not found. Using fallback ID (234)."
    NV_UVM_MAJOR="234"
fi

cat <<EOF >> $CONF_FILE
# --- GPU PASSTHROUGH ---
lxc.cgroup2.devices.allow: c $NV_CTL_MAJOR:* rwm
lxc.cgroup2.devices.allow: c $NV_UVM_MAJOR:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
EOF

# --- 7. Application Setup ---
echo "We are awakening the container and purifying the internal setup..."
pct start "$CT_ID"
sleep 10

echo "The Scribe is now preparing the internal laboratory (~15 minutes)..."
pct exec "$CT_ID" -- bash -c "$(curl -fsSL https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/setup_app.sh)"

# --- 8. Finalization ---
msg_box "The installation is complete. We are honored to have served you.\n\nStarke County Government: Secure. Local. Transparent."

echo -e "\nCounty Scribe is ready!"
IP=$(pct exec "$CT_ID" -- hostname -I | awk '{print $1}')
echo "Access it at: http://${IP}:8000"
