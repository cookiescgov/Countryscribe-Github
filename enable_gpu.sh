#!/usr/bin/env bash

# ==========================================================================================
# 🏛️  County Scribe (郡書記) - GPU Upgrade Utility
# ==========================================================================================
# Run this script on your Proxmox Host to inject NVIDIA GPU Passthrough 
# into an existing County Scribe LXC container that was originally installed in CPU mode.

set -e

# --- 1. Identify Container ---
DEFAULT_CT=$(pct list | awk 'tolower($0) ~ /scribe/ {print $1}' | head -n 1)
CT_ID=$(whiptail --title "County Scribe GPU Upgrade" --inputbox "Please enter the LXC ID of your existing County Scribe container:" 10 60 "$DEFAULT_CT" 3>&1 1>&2 2>&3)
if [ -z "$CT_ID" ]; then exit 0; fi

CONF_FILE="/etc/pve/lxc/$CT_ID.conf"
if [ ! -f "$CONF_FILE" ]; then
    whiptail --title "Error" --msgbox "Container $CT_ID does not exist on this Proxmox node!" 10 60
    exit 1
fi

# Check if already has GPU configured
if grep -q "lxc.cgroup2.devices.allow: c.*rwm" "$CONF_FILE"; then
    if ! whiptail --title "Warning" --yesno "This container already has device passthrough configurations.\nDo you want to re-apply the GPU bindings anyway?" 10 60; then
        exit 0
    fi
    # Strip old GPU configs to prevent duplicates
    sed -i '/# --- GPU PASSTHROUGH ---/d' "$CONF_FILE"
    sed -i '/lxc.cgroup2.devices.allow: c .* rwm/d' "$CONF_FILE"
    sed -i '/lxc.mount.entry: \/dev\/nvidia/d' "$CONF_FILE"
    sed -i '/lxc.mount.entry: \/dev\/dri/d' "$CONF_FILE"
    sed -i '/lxc.mount.entry: .*libnvidia-ml/d' "$CONF_FILE"
    sed -i '/lxc.mount.entry: .*libcuda/d' "$CONF_FILE"
    sed -i '/lxc.mount.entry: .*nvidia-smi/d' "$CONF_FILE"
    sed -i '/lxc.hook.autodev:.*mount_hook.sh/d' "$CONF_FILE"
fi

echo "Scanning for NVIDIA Hardware on Host..."
if [ -c /dev/nvidia0 ] || [ -c /dev/dri/renderD128 ]; then
# --- 2. GPU Passthrough Configuration ---
mkdir -p /var/lib/lxc/$CT_ID/
cat <<'EOF_HOOK' > /var/lib/lxc/$CT_ID/mount_hook.sh
#!/bin/sh
chmod 666 ${LXC_ROOTFS_MOUNT}/dev/nvidia* 2>/dev/null || true
chmod 666 ${LXC_ROOTFS_MOUNT}/dev/dri/renderD* 2>/dev/null || true
EOF_HOOK
chmod +x /var/lib/lxc/$CT_ID/mount_hook.sh

# 2. Inject Stable Device IDs (NVIDIA Standard)
echo "# --- GPU PASSTHROUGH ---" >> $CONF_FILE
echo "lxc.cgroup2.devices.allow: c 195:* rwm" >> $CONF_FILE
echo "lxc.cgroup2.devices.allow: c 511:* rwm" >> $CONF_FILE

echo "lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file" >> $CONF_FILE
echo "lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file" >> $CONF_FILE
echo "lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file" >> $CONF_FILE

# 3. Deep Library Discovery (Find symlinks and versioned targets)
echo "Scanning host for NVIDIA driver libraries..."
for LIB in "libnvidia-ml.so.1" "libcuda.so.1"; do
    HOST_PATH=$(find /usr/lib -name "$LIB" 2>/dev/null | head -n 1)
    if [ -n "$HOST_PATH" ]; then
        # Mount the symlink
        echo "lxc.mount.entry: $HOST_PATH ${HOST_PATH#/ } none bind,optional,ro,create=file" >> $CONF_FILE
        # Resolve and mount the real versioned file
        REAL_PATH=$(readlink -f "$HOST_PATH")
        if [ "$REAL_PATH" != "$HOST_PATH" ]; then
             echo "lxc.mount.entry: $REAL_PATH ${REAL_PATH#/ } none bind,optional,ro,create=file" >> $CONF_FILE
        fi
    fi
done

# 4. Mount nvidia-smi binary
NV_SMI=$(command -v nvidia-smi 2>/dev/null)
if [ -n "$NV_SMI" ]; then
    echo "lxc.mount.entry: $NV_SMI usr/bin/nvidia-smi none bind,optional,ro,create=file" >> $CONF_FILE
fi

echo "lxc.hook.autodev: /var/lib/lxc/$CT_ID/mount_hook.sh" >> $CONF_FILE

whiptail --title "Success" --msgbox "GPU Hardware bindings successfully injected into LXC $CT_ID!\n\nThe container will now be restarted to apply changes and automatically rebuild Docker with NVIDIA support..." 12 70
    
    # 3. Restart and Rebuild 
    pct stop "$CT_ID" || true
    sleep 3
    pct start "$CT_ID"
    sleep 5
    
    echo "Triggering dynamic GPU Docker override inside the container..."
    pct exec "$CT_ID" -- bash -c "cd /opt/county-scribe && bash setup_app.sh"
    
    echo -e "\n✅ GPU Upgrade Complete! Access your scribe at http://$(pct exec $CT_ID -- hostname -I | awk '{print $1}'):8000"
else
    whiptail --title "Error" --msgbox "No GPU devices (/dev/nvidia* or /dev/dri/renderD*) were found on this Proxmox host. Upgrade aborted." 10 60
    # Clean up empty markers
    sed -i '/# --- GPU PASSTHROUGH ---/d' "$CONF_FILE"
fi
