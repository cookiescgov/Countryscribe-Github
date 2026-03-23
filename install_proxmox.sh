#!/bin/bash

# ==========================================================================================
# County Scribe - Proxmox LXC Helper Script (Official Installer)
# ==========================================================================================

set -e

# --- 1. Dependencies Check ---
if ! command -v git &> /dev/null; then
    echo "Git is required. Installing..."
    apt-get update && apt-get install -y git
fi

# --- 2. Interactive UI (Whiptail) ---
function msg_info() {
    whiptail --title "County Scribe Installer" --msgbox "$1" 10 60
}

function get_input() {
    whiptail --title "County Scribe Setup" --inputbox "$1" 10 60 "$2" 3>&1 1>&2 2>&3
}

function get_password() {
    whiptail --title "County Scribe Setup" --passwordbox "$1" 10 60 3>&1 1>&2 2>&3
}

function get_choice() {
    local title=$1
    local prompt=$2
    shift 2
    whiptail --title "$title" --menu "$prompt" 15 60 6 "$@" 3>&1 1>&2 2>&3
}

# --- 3. Welcome ---
whiptail --title "County Scribe" --msgbox "Welcome to the County Scribe Proxmox LXC Installer.\n\nThis will create a Debian 13 LXC with Docker and NVIDIA GPU Passthrough (Stripped of Speaker ID)." 12 60

# --- 4. Gather Configuration ---
NEXT_ID=$(pvesh get /cluster/nextid)
CT_ID=$(get_input "Enter Container ID" "$NEXT_ID")
CT_HOSTNAME=$(get_input "Enter Hostname" "county-scribe")
CT_PASSWORD=$(get_password "Enter Root Password for LXC")

# Storage Selection
STORAGE_LIST=$(pvesm status | grep -E "dir|lvm|zfspool" | awk '{print $1 " " $2}' | xargs)
CT_STORAGE=$(get_choice "Storage Selection" "Select storage for the LXC container" $(echo $STORAGE_LIST))

# --- 5. Confirmation ---
if ! whiptail --title "Confirm Installation" --yesno "Ready to create LXC $CT_ID ($CT_HOSTNAME) on $CT_STORAGE?\n\nThis will download the Debian 13 template and install all dependencies." 12 60; then
    echo "Installation cancelled."
    exit 0
fi

# --- 6. Execution ---
echo "Starting Installation... Please wait."

# Clone/Update Repo to /tmp
REPO_DIR="/tmp/county-scribe-install"
if [ -d "$REPO_DIR" ]; then rm -rf "$REPO_DIR"; fi
git clone https://github.com/[USERNAME]/county-scribe "$REPO_DIR"

# Run the Build Script with the gathered variables
cd "$REPO_DIR"
# Inject variables into environment so build_lxc.sh can use them without 'read'
export CT_ID CT_HOSTNAME CT_PASSWORD CT_STORAGE
chmod +x LXC/build_lxc.sh

# Run the build script
./LXC/build_lxc.sh

# Cleanup
rm -rf "$REPO_DIR"
