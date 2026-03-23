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

# Ask for OS choice
CT_OS=$(whiptail --title "County Scribe (郡書記)" --menu "Please select your preferred Host Operating System:" 15 70 2 \
    "debian-13" "Debian 13 (Trixie/Stable - Recommended)" \
    "ubuntu-24.04" "Ubuntu 24.04 LTS (Noble)" 3>&1 1>&2 2>&3)
if [ -z "$CT_OS" ]; then CT_OS="debian-13"; fi

# --- 3. Host Preparation ---
echo "We are most humbly preparing the host environment..."
if ! command -v git &> /dev/null; then
    apt-get update && apt-get install -y git &>/dev/null
fi

# Ensure Unprivileged LXCs can access mapped GPUs without complex UID/GID mapping
# by automatically setting device permissions on the host via an LXC autodev hook.
mkdir -p /var/lib/lxc/$CT_ID/
cat <<'EOF_HOOK' > /var/lib/lxc/$CT_ID/mount_hook.sh
#!/bin/sh
chmod 666 ${LXC_ROOTFS_MOUNT}/dev/nvidia* 2>/dev/null || true
chmod 666 ${LXC_ROOTFS_MOUNT}/dev/dri/renderD* 2>/dev/null || true
EOF_HOOK
chmod +x /var/lib/lxc/$CT_ID/mount_hook.sh

# --- 4. Download Template ---
echo "We are gracefully retrieving the $CT_OS template..."
pveam update &>/dev/null
TEMPLATE=$(pveam available --section system | grep "$CT_OS" | head -n1 | awk '{print $2}')
if [ -z "$TEMPLATE" ] && [ "$CT_OS" == "debian-13" ]; then
    echo "⚠️ Debian 13 template not found. Falling back to Debian 12..."
    TEMPLATE=$(pveam available --section system | grep "debian-12" | head -n1 | awk '{print $2}')
fi
pveam download local "$TEMPLATE" &>/dev/null || true

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
    --unprivileged 1 \
    --features nesting=1,keyctl=1 \
    --onboot 1 \
    --timezone host

# --- 6. GPU Passthrough Configuration (Polite Auto-Detection) ---
echo "We are humbly mapping the GPU pathways for container $CT_ID..."
CONF_FILE="/etc/pve/lxc/$CT_ID.conf"

echo "# --- GPU PASSTHROUGH ---" >> $CONF_FILE

# Process NVIDIA Devices
has_gpu=0
for dev in /dev/nvidia*; do
    if [ -e "$dev" ]; then
        major=$(ls -l "$dev" | awk '{print $5}' | cut -d, -f1)
        minor=$(ls -l "$dev" | awk '{print $6}')
        echo "lxc.cgroup2.devices.allow: c $major:* rwm" >> $CONF_FILE
        echo "lxc.mount.entry: $dev ${dev#/dev/} none bind,optional,create=file" >> $CONF_FILE
        has_gpu=1
    fi
done

# Process standard DRI / QuickSync / AMD Devices
for dev in /dev/dri/renderD*; do
    if [ -e "$dev" ]; then
        major=$(ls -l "$dev" | awk '{print $5}' | cut -d, -f1)
        minor=$(ls -l "$dev" | awk '{print $6}')
        echo "lxc.cgroup2.devices.allow: c $major:* rwm" >> $CONF_FILE
        echo "lxc.mount.entry: $dev ${dev#/dev/} none bind,optional,create=file" >> $CONF_FILE
        has_gpu=1
    fi
done

if [ "$has_gpu" -eq 1 ]; then
    echo "lxc.hook.autodev: /var/lib/lxc/$CT_ID/mount_hook.sh" >> $CONF_FILE
else
    echo "⚠️ We apologize, but no GPU devices (/dev/nvidia* or /dev/dri/renderD*) were found on the host."
fi

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
