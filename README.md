# 🏛️ County Scribe 2.0 🏛️

**A resilient and specialized deployment package for local government transcription.**

> "Secure. Local. Transparent."

---
<img width="3822" height="1770" alt="image" src="https://github.com/user-attachments/assets/0fcdca18-16f1-486e-b65d-0bcf0f163df4" />


> [!IMPORTANT]
> **Current Status:** This project is verified to work on **Proxmox LXC** with **NVIDIA RTX 2000 Ada (A2000)** hardware. If you are using different NVIDIA hardware, you may need to adapt the device IDs and major IDs in the configuration. 
> 
> **Note:** The universal deployment scripts for **Windows, Linux, and Mac (Standard Docker)** are currently provided as-is and have **not yet been tested**. 

County Scribe is an open-source tool designed to provide local governments with a secure, self-hosted solution for transcribing public meetings.
 By running locally on your own hardware, it ensures that sensitive data never leaves your infrastructure while providing high-accuracy transcripts for official records.

---

## 🚀 Installation Options

County Scribe is fully containerized and runs flawlessly on virtually any operating system or Hypervisor via Docker. Choose the deployment method that fits your infrastructure:

### Option 1: Proxmox LXC (Automated GPU Setup)
For IT Departments using Proxmox, you can instantly deploy a fully configured **Debian 13 LXC** with automatic **NVIDIA GPU Passthrough** using this single command in your Proxmox Host shell:
```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/install_proxmox.sh)"
```

### Option 2: Universal Docker (Windows, Mac, Standard Linux)
If you do not use Proxmox, you can easily run County Scribe anywhere Docker is installed.
1. Download this entire repository to your computer (Code -> Download ZIP).
2. Ensure you have **Docker Desktop** (Windows/Mac) or **Docker** (Linux) installed and running.
3. Open the downloaded folder and double-click the launcher for your OS:
   - **Windows:** Double-click `Windows_Install.bat`
   - **Linux / Mac:** Open a terminal in the folder and run `bash Linux_Mac_Install.sh`

### **Installer Features:**
*   **Master Control Menu:** A single interactive prompt handles fresh installations, rolling updates, and retroactively enabling GPU support.
*   **Smart Hardware Detection:** Seamlessly offers NVIDIA GPU Passthrough for blazing speed, or a universally compatible CPU-only fallback mode.
*   **Intelligent Auto-Discovery:** Automatically pre-fills Container IDs by scanning your Proxmox node for existing County Scribe deployments.
*   **Fast, Dependency-Free AI:** Deploys a deeply optimized `faster-whisper` inference pipeline capable of transcribing massive files without bloated wrappers or cloud tokens.
*   **Secure & Unprivileged:** Deploys as an ultra-secure Unprivileged LXC on Debian 13 without compromising direct hardware access.

---

## 📖 User Guide

### **Accessing the Interface**
Once installed, the application is available at `http://[LXC-IP]:8000`. 

### **Network Configuration**
For production environments, it is recommended to use a reverse proxy (such as **Nginx**, **Traefik**, **Caddy**, or **Apache**) to provide a friendly URL and SSL (HTTPS) encryption.

### **Generating Minutes**
1.  **Transcription:** Upload meeting audio or provide a YouTube link. Use the "Official Record" setting for maximum accuracy.
2.  **Exporting:** Use the **Copy Text** button to capture the clean transcript.
3.  **AI Integration:** Paste the transcript into tools like **Google NotebookLM** to generate formal meeting minutes, summaries, and action items instantly.

### **Data Retention**
The system automatically archives transcripts and stores them locally for **180 days** by default. This can be managed via the "Archives" tab in the UI.

---

## 🛠️ Maintenance & Upgrades

County Scribe administrators have two simple ways to keep their systems up-to-date and fully accelerated:

### **1. The Master Proxmox Menu (Hypervisor Level)**
Running the original installation script from your **Proxmox Node shell** acts as a unified master menu:
```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/install_proxmox.sh)"
```
From here you can:
*   **Install** a brand new container.
*   **Update** an existing container (automatically updating both the Debian OS and the Scribe app).
*   **Upgrade to GPU**: If you originally installed in CPU-only mode but have securely installed an NVIDIA GPU, this option automatically maps the new hardware to your container without reinstalling!

### **2. The Quick Update Alias (Container Level)**
If you are logged directly into the console of your **County Scribe LXC**, you can instantly apply all system patches, pull the latest code, and rebuild Docker by simply typing:
```bash
update
```

---

## 💻 Development & Contribution

If you wish to modify the source code or contribute to the project:

1.  **Fork/Clone:** Fork the repository on GitHub and clone it to your local environment.
2.  **Pull Requests:** Submit a Pull Request with your improvements or bug fixes.

---

## ⚠️ Requirements & Hardware Support
*   **GPU Mode (Recommended):** Requires an NVIDIA GPU for fast, acceptable transcription speeds (taking minutes per meeting). Ensure the latest NVIDIA drivers are installed on the **Proxmox Host** before running the installer.
*   **CPU Mode (Supported but Slow):** The application will automatically and safely fall back to CPU inference if no GPU is detected (or chosen during installation). **Warning:** Transcribing long meetings on a standard CPU can take many hours. CPU mode is only recommended for testing or extremely short clips.
*   **Concurrency:** The system is designed to process one meeting at a time to maximize hardware efficiency.

---

## 🔧 Manual GPU Configuration (Advanced)
There is no automatic gpu detection yet but  you can add these lines to your LXC configuration file (located at `/etc/pve/lxc/[ID].conf` on your Proxmox host if you have a A2000 GPU):

```bash
# Allow NVIDIA device nodes
lxc.cgroup2.devices.allow: c 195:* rwm
lxc.cgroup2.devices.allow: c 511:* rwm
lxc.cgroup2.devices.allow: c 238:* rwm

# Mount NVIDIA character devices
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-modeset dev/nvidia-modeset none bind,optional,create=file
```

---

## 📜 License
This project is licensed under the **AGPL v3 License** to ensure that improvements made by the community remain available to all local governments.

---

## ⚖️ Disclaimer & No Warranty
**County Scribe is experimental, open-source software provided "AS-IS" and without any warranty of any kind, express or implied.** 

While the underlying AI models strive for high fidelity, automated transcriptions are inherently prone to hallucinatory errors, misattributions, or omissions. **Do not rely entirely on the automated output for legally binding public records without human verification.** The developers, contributors, and associated entities hold no liability for any claims, damages, or legal actions arising from the use of this software or its generated transcripts.
