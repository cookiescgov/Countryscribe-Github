#!/usr/bin/env bash

# ==========================================================================================
# 🏛️ County Scribe (郡書記)
# Created with Care by: Luke Cook, Starke County Government IT Department
# ==========================================================================================
# We humbly thank you for choosing our transcription service.
# ==========================================================================================

# Sourcing Proxmox Helper Functions
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)

# --- THE OMOTENASHI INTERCEPTOR ---
# This function intercepts all UI calls to ensure total branding purity.
function whiptail() {
  local ARGS=("$@")
  for i in "${!ARGS[@]}"; do
    # Replace the generic background title
    if [[ "${ARGS[$i]}" == "Proxmox VE Helper Scripts" ]]; then
      ARGS[$i]="County Scribe - Starke County Government IT"
    fi
    # Replace the generic box titles
    if [[ "${ARGS[$i]}" == "Community-Scripts Options" ]]; then
      ARGS[$i]="County Scribe: Humble Installation Service"
    fi
    # Soften the "Default Settings" prompt strings if they appear
    if [[ "${ARGS[$i]}" == "Would you like to proceed with the Default Installation?" ]]; then
      ARGS[$i]="Would you be so kind as to proceed with our recommended Standard Installation?\n\n(We have prepared everything for your comfort.)"
    fi
  done
  command whiptail "${ARGS[@]}"
}

# --- OVERRIDE BRANDING FUNCTIONS ---
function header_info {
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
}

function start {
  if (whiptail --title "County Scribe Installation" --yesno "Would you be so kind as to proceed with the Standard Installation of County Scribe?\n\n(We most humbly recommend this path for the most harmonious experience.)" 12 70); then
    msg_info "We are setting up the Scribe's environment with the utmost care..."
  else
    msg_info "You have chosen the Advanced Path. We shall attend to every detail with extra devotion."
    export ADVANCED="yes"
  fi
}

# --- APP CONFIGURATION ---
APP="County Scribe"
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

# Start the interactive process
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
