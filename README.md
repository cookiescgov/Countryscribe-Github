# 🏛️ County Scribe
**Secure, Local Audio Transcription for Local Government.**

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
*   **Automated Provisioning:** Creates a Debian 13 (Trixie) container.
*   **GPU Acceleration:** Auto-detects and configures NVIDIA GPU passthrough for fast AI inference.
*   **Containerized:** Automatically installs Docker and the NVIDIA Container Toolkit.
*   **Optimized Build:** Deploys a high-accuracy WhisperX pipeline optimized for clear government records.

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

## 🛠️ Development & Contribution

If you wish to modify the source code or contribute to the project:

1.  **Fork/Clone:** Fork the repository on GitHub and clone it to your local environment.
2.  **Pull Requests:** Submit a Pull Request with your improvements or bug fixes.

---

## ⚠️ Requirements & Troubleshooting
*   **Hardware:** Requires an NVIDIA GPU for acceptable transcription speeds.
*   **Drivers:** Ensure the latest NVIDIA drivers are installed on the **Proxmox Host** before running the installer.
*   **Concurrency:** The system is designed to process one meeting at a time to maximize GPU efficiency.

---

## 📜 License
This project is licensed under the **AGPL v3 License** to ensure that improvements made by the community remain available to all local governments.
