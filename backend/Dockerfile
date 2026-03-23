# =========================
# Frontend build stage
# =========================
FROM node:18-alpine AS frontend-build
WORKDIR /app-frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend .
RUN npm run build


# =========================
# Backend / API stage
# =========================
FROM pytorch/pytorch:2.1.2-cuda11.8-cudnn8-runtime

WORKDIR /app

# ---- System dependencies ----
ENV TZ=America/Chicago
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ffmpeg \
    tzdata \
    libgl1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# ---- Python tooling ----
RUN pip install --upgrade pip

# ---- PIN TORCH STACK (CRITICAL FIX) ----
RUN pip install --no-cache-dir \
    torch==2.1.2 \
    torchaudio==2.1.2 \
    torchvision==0.16.2

# ---- Core Python deps ----
RUN pip install --no-cache-dir \
    "numpy<2" \
    fastapi \
    uvicorn \
    python-multipart \
    pydantic \
    reportlab \
    python-docx \
    pandas \
    "transformers==4.35.2" \
    huggingface-hub \
    ctranslate2 \
    faster-whisper \
    "pyannote-audio==3.1.1" \
    nltk \
    scipy \
    omegaconf \
    onnxruntime-gpu \
    setuptools \
    yt-dlp

# ---- PyAV ----
RUN pip install --no-cache-dir "av>=11.0.0"

# ---- WhisperX ----
RUN pip install --no-cache-dir --no-deps \
    git+https://github.com/m-bain/whisperx.git

# ---- Copy backend code ----
COPY backend ./backend
COPY uploads ./uploads

# ---- Copy frontend build output ----
COPY --from=frontend-build /app-frontend/build ./static

# ---- Cache directories ----
RUN mkdir -p /root/.cache/huggingface /root/.cache/torch

# ---- Run FastAPI ----
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
