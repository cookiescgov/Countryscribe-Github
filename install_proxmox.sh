#!/usr/bin/env bash

# ==========================================================================================
# County Scribe - Proxmox Helper Script (Tteck-Style)
# ==========================================================================================
# Copyright (c) 2021-2026 tteck (Refactored for County Scribe)
# Source: https://github.com/community-scripts/ProxmoxVE
# ==========================================================================================

# Sourcing Proxmox Helper Functions
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)

# App Configuration
APP="County Scribe"
var_tags="${var_tags:-transcription;nvidia;docker}"
var_cpu="${var_cpu:-4}"
var_ram="${var_ram:-8192}"
var_disk="${var_disk:-40}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-0}" # Privileged recommended for easy GPU access

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  msg_info "Updating base system"
  $STD apt update
  $STD apt upgrade -y 
  msg_ok "Base system updated"
  msg_info "Updating County Scribe"
  $STD bash -c "cd /opt/county-scribe && git pull && docker compose up -d --build"
  msg_ok "Updated successfully!"
  exit
}

start
build_container
description

# --- Post-Build: GPU PASSTHROUGH (Surgical) ---
msg_info "Configuring NVIDIA GPU Passthrough"

CT_ID=$(pvesh get /cluster/nextid -1) # The ID we just created
CONF_FILE="/etc/pve/lxc/$CT_ID.conf"

# Detect Nvidia Major IDs
NV_CTL_MAJOR=$(ls -l /dev/nvidiactl | awk '{print $5}' | cut -d, -f1)
NV_UVM_MAJOR=$(ls -l /dev/nvidia-uvm | awk '{print $5}' | cut -d, -f1)

# Inject Passthrough Rules
cat <<EOF >> $CONF_FILE
# --- GPU PASSTHROUGH ---
lxc.cgroup2.devices.allow: c $NV_CTL_MAJOR:* rwm
lxc.cgroup2.devices.allow: c $NV_UVM_MAJOR:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
EOF
msg_ok "GPU Passthrough configured"

# --- Start Container and Run Setup ---
msg_info "Starting Container for App Installation"
pct start $CT_ID
sleep 10 # Wait for network

msg_info "Running Application Setup (This will take time...)"
pct exec $CT_ID -- bash -c "$(curl -fsSL https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/setup_app.sh)"

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW} Access the interface at the following URL:${CL}"
IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:8000${CL}"
