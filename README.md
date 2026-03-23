# 🏛️ County Scribe
**Official local, secure meeting transcription tool.**

This version is optimized for **Proxmox LXC (Debian 13)** with full **NVIDIA GPU Passthrough**. 
*Note: Speaker Identification (Diarization) has been removed from this build for maximum accuracy and simplicity.*

---

## 🛠️ Proxmox LXC Installation (The "One-Liner")
Run this single command in your **Proxmox Host Shell** to build the entire system automatically.

```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/cookiescgov/Countryscribe-Github/main/install_proxmox.sh)"
```

### **What the Installer Does:**
*   **Interactive UI:** Asks for Container ID, Hostname, and Storage.
*   **Automated LXC:** Creates a Debian 13 (Trixie) container.
*   **GPU Passthrough:** Auto-detects and mounts your NVIDIA GPU.
*   **Docker & Toolkit:** Installs Docker and NVIDIA Container Toolkit.
*   **County Scribe:** Deploys the stripped-down, high-accuracy build.

---

## 💻 Local Management (GitHub Desktop)
Use these steps to manage the code you've published to GitHub.

1. **Open GitHub Desktop.**
2. **Select Repository:** Choose `Countryscribe-Github`.
3. **Commit & Push:** Whenever you make changes locally, type a summary and click **Commit to main**, then **Push origin**.
4. **Deploy:** Any changes pushed here will be used the next time you run the Proxmox one-liner.

---

## 📖 User Guide
*   **Access:** Once installed, go to `http://[LXC-IP]:8000`.
*   **Accuracy:** Use "Official Record" for the best results.
*   **NotebookLM:** Use the "Copy Text" button to grab the clean transcript and paste it into Google NotebookLM for automatic minutes generation.
*   **Retention:** Transcripts are auto-archived and kept for 180 days.

---

## ⚠️ Troubleshooting
*   **GPU Not Found:** Ensure NVIDIA drivers are installed on the **Proxmox Host**.
*   **System Busy:** Only one meeting can be processed at a time.
