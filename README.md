# 🏛️ County Scribe 🏛️

**A resilient and specialized deployment package for local government transcription.**

> "Secure. Local. Transparent."

---


> [!WARNING]
> **Work in Progress:** This project is currently under active development. Please wait until development is finalized before attempting deployment in a production environment.

County Scribe is an open-source tool designed to provide local governments with a secure, self-hosted solution for transcribing public meetings.
 By running locally on your own hardware, it ensures that sensitive data never leaves your infrastructure while providing high-accuracy transcripts for official records.

---

## 🚀 Quick Install (Proxmox LXC)

For IT Departments using Proxmox, you can deploy a fully configured **Debian 13 LXC** with **NVIDIA GPU Passthrough** and **Docker** using this single command in your Proxmox Host shell:

```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/install_proxmox.sh)"
```

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

## 📜 License
This project is licensed under the **AGPL v3 License** to ensure that improvements made by the community remain available to all local governments.
