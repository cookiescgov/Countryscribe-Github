# County Scribe - Proxmox LXC Deployment

This folder contains the necessary scripts and modified files to deploy County Scribe in a **Debian 13 LXC** on Proxmox with **GPU Passthrough** and **Docker**.

## 📁 Files in this folder
- `build_lxc.sh`: The main installer script to run on your Proxmox Host.
- `Dockerfile`: Modified backend Dockerfile (removes `pyannote-audio`).
- `requirements.txt`: Modified requirements (removes `pyannote`).
- `main.py`: Modified `main.py` (removes all speaker/diarization logic).
- `App.js`: Modified frontend (removes all speaker/diarization UI).

## 🚀 How to Use

1. **Transfer Files to Proxmox Host:**
   Copy the *entire* `LXC` folder and the `county scribe` folder to your Proxmox host (e.g., using SCP or SFTP).
   
   The structure on Proxmox should look like this:
   ```text
   /root/
   ├── LXC/
   │   ├── build_lxc.sh
   │   ├── Dockerfile
   │   ├── main.py
   │   └── ...
   └── county scribe/
       ├── backend/
       ├── frontend/
       └── ...
   ```

2. **Run the Installer:**
   On your Proxmox shell, navigate to the parent directory and run:
   ```bash
   chmod +x LXC/build_lxc.sh
   ./LXC/build_lxc.sh
   ```

3. **Follow the Prompts:**
   - Enter your desired **Container ID** and **Hostname**.
   - Enter a **Root Password**.
   - Select your **Storage** (e.g., `local-lvm` or `local-zfs`).

4. **Completion:**
   The script will:
   - Create the LXC.
   - Configure GPU passthrough (detecting your Nvidia IDs automatically).
   - Install Docker and the Nvidia Container Toolkit.
   - Inject the modified code (stripping all speaker logic).
   - Start the Docker containers.

## ⚠️ Notes
- **Speaker Identification:** This version has been **completely stripped** of speaker identification/diarization as requested.
- **GPU Drivers:** Ensure you have the Nvidia drivers installed on your **Proxmox Host**. The LXC will share these drivers.
- **VRAM:** Whisper models (especially `large-v3`) require significant VRAM. 8GB+ is recommended for the container.
