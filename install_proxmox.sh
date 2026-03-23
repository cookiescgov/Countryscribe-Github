#!/usr/bin/env bash

# ==========================================================================================
# 🏛️ County Scribe (郡書記)
# Created with Care by: Luke Cook, Starke County Government IT Department
# ==========================================================================================
# We humbly thank you for choosing our transcription service.
# ==========================================================================================

# Sourcing Proxmox Helper Functions
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)

# App Configuration
APP="County Scribe (Official Build)"
var_tags="${var_tags:-omotenashi;government;transcription;nvidia}"
var_cpu="${var_cpu:-4}"
var_ram="${var_ram:-8192}"
var_disk="${var_disk:-40}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-0}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  msg_info "We are most humbly refreshing your system resources"
  $STD apt update
  $STD apt upgrade -y 
  msg_ok "The base system has been safely updated for your convenience"
  msg_info "Gently deploying the latest County Scribe logic"
  $STD bash -c "cd /opt/county-scribe && git pull && docker compose up -d --build"
  msg_ok "We are pleased to inform you that the Scribe is now up to date"
  exit
}

start
build_container
description

# --- Post-Build: GPU PASSTHROUGH ---
msg_info "Please allow us to map the NVIDIA GPU pathways for your AI inference"

CT_ID=$(pvesh get /cluster/nextid -1)
CONF_FILE="/etc/pve/lxc/$CT_ID.conf"

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
msg_ok "The silicon power has been most respectfully harnessed"

# --- Start Container and Run Setup ---
msg_info "We are humbly awakening the container for you"
pct start $CT_ID
sleep 10

msg_info "Please be patient as we provision the Scribe (~15 minutes)"
pct exec $CT_ID -- bash -c "$(curl -fsSL https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/setup_app.sh)"

msg_ok "Installation is complete. We are honored to serve you.\n"
echo -e "${CREATING}${GN}County Scribe is now fully operational!${CL}"
echo -e "${INFO}${YW} You may access your secure interface here:${CL}"
IP=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:8000${CL}"
echo -e "\n${INFO}${BGN}Starke County IT: Dedicated to your security and peace of mind.${CL}"
