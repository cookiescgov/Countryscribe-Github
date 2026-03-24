import os
import asyncio
import json
import glob
import re
import gc
import sys
from datetime import datetime, timedelta
from typing import List, Optional
from io import BytesIO

from fastapi import FastAPI, UploadFile, File, Response, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from docx import Document

import torch
import yt_dlp


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
ARCHIVE_ROOT = "archive"
os.makedirs(ARCHIVE_ROOT, exist_ok=True)

# GLOBAL LOCK: prevent concurrent meetings
processing_lock = asyncio.Lock()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
class User(BaseModel):
    username: str


class TranscriptionSegment(BaseModel):
    start: str
    end: str
    text: str
    speaker: str = "Speaker"


# ─────────────────────────────────────────────
# Department DB (simple JSON file)
# ─────────────────────────────────────────────
USER_DB_FILE = os.path.join(ARCHIVE_ROOT, "users_db.json")


def load_users():
    if not os.path.exists(USER_DB_FILE):
        defaults = {
            "Planning Commission": {"username": "Planning Commission"},
            "Council/Commissioners": {"username": "Council/Commissioners"},
            "Drainage Board": {"username": "Drainage Board"},
            "Park Board": {"username": "Park Board"},
            "Health Board": {"username": "Health Board"},
        }
        try:
            with open(USER_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(defaults, f, indent=2)
            os.chmod(USER_DB_FILE, 0o666)
        except Exception:
            pass
        return defaults

    try:
        with open(USER_DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_user_to_db(username: str):
    users = load_users()
    if username not in users:
        users[username] = {"username": username}
        with open(USER_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
        try:
            os.chmod(USER_DB_FILE, 0o666)
        except Exception:
            pass


# ─────────────────────────────────────────────
# Identity helpers (Auth-Free Department Tagging)
# ─────────────────────────────────────────────
async def get_current_user(x_department: str = Header(default="Unknown_Department")) -> User:
    """
    Reads the X-Department header provided by the frontend UI to organize files.
    No authentication/JWT required.
    """
    return User(username=x_department)


# ─────────────────────────────────────────────
# Archive helpers
# ─────────────────────────────────────────────
def get_user_archive_dir(username: str) -> str:
    safe_name = re.sub(r"[^a-zA-Z0-9]", "_", username)
    user_dir = os.path.join(ARCHIVE_ROOT, safe_name)
    if not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
        try:
            os.chmod(user_dir, 0o777)
        except Exception:
            pass
    return user_dir


def format_timestamp(seconds: float) -> str:
    if seconds is None:
        return "00:00:00.000"
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(int(td.total_seconds()), 3600)
    minutes, sec = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{sec:02}.{td.microseconds // 1000:03}"


# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"message": "County Scribe API is running."}


# ─────────────────────────────────────────────
# Department User Management (Auth-Free)
# ─────────────────────────────────────────────
@app.get("/api/users")
def get_all_users():
    """Returns a purely string-based list of available departments from DB."""
    users = load_users()
    return list(users.keys())


@app.post("/api/register")
async def register_department(username: str = Form(...)):
    """Accepts a new department name and saves it to the dropdown database."""
    save_user_to_db(username.strip())
    return {"message": "Department created", "username": username.strip()}


@app.delete("/api/users/{username}")
async def delete_department(username: str):
    """Deletes a department from the dropdown database."""
    users = load_users()
    if username in users:
        del users[username]
        with open(USER_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
        return {"message": "Department deleted"}
    raise HTTPException(status_code=404, detail="Department not found")


# ─────────────────────────────────────────────
# Archive endpoints (per-user)
# ─────────────────────────────────────────────
@app.get("/api/archives")
def list_archives(current_user: User = Depends(get_current_user)):
    user_dir = get_user_archive_dir(current_user.username)
    files = glob.glob(os.path.join(user_dir, "*.json"))

    archives = []
    for fpath in files:
        stats = os.stat(fpath)
        filename = os.path.basename(fpath)

        meeting_date = "Unknown"
        match = re.match(r"(\d{4}-\d{2}-\d{2})", filename)
        if match:
            meeting_date = match.group(1)

        archives.append(
            {
                "filename": filename,
                "created": datetime.fromtimestamp(stats.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "meeting_date": meeting_date,
                "size_kb": round(stats.st_size / 1024, 2),
            }
        )

    return sorted(archives, key=lambda x: x["filename"], reverse=True)


@app.get("/api/archives/{filename}")
def get_archive(filename: str, current_user: User = Depends(get_current_user)):
    user_dir = get_user_archive_dir(current_user.username)
    safe_path = os.path.join(user_dir, os.path.basename(filename))

    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="Archive not found")

    with open(safe_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.delete("/api/archives/{filename}")
def delete_archive(filename: str, current_user: User = Depends(get_current_user)):
    user_dir = get_user_archive_dir(current_user.username)
    safe_path = os.path.join(user_dir, os.path.basename(filename))

    if os.path.exists(safe_path):
        os.remove(safe_path)
        return {"status": "deleted"}

    raise HTTPException(status_code=404, detail="File not found")


@app.post("/api/archives/prune")
def prune_archives(days: int = 180, current_user: User = Depends(get_current_user)):
    cutoff = (datetime.now() - timedelta(days=days)).timestamp()
    user_dir = get_user_archive_dir(current_user.username)

    deleted_count = 0
    files = glob.glob(os.path.join(user_dir, "*.json"))
    for fpath in files:
        if os.stat(fpath).st_mtime < cutoff:
            os.remove(fpath)
            deleted_count += 1

    return {"status": "success", "deleted": deleted_count, "retention_days": days}


# ─────────────────────────────────────────────
# YouTube download helper
# ─────────────────────────────────────────────
def download_youtube_audio(url: str) -> tuple[str, str]:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    output_template = f"temp_yt_{timestamp}"

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}],
        "quiet": True,
        "no_warnings": True,
        "source_address": "0.0.0.0",
        "socket_timeout": 60,
        "retries": 20,
        "fragment_retries": 20,
        "concurrent_fragment_downloads": 4,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        title = info.get("title", "YouTube_Video")
        print(f"Starting download: {title}", flush=True)
        ydl.download([url])
        final_filename = f"{output_template}.m4a"
        return final_filename, title


# ─────────────────────────────────────────────
# Transcribe endpoint
# ─────────────────────────────────────────────
@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    model_size: str = Form("large-v3"),
    diarize: bool = Form(False),
    meeting_date: str = Form(None),
    current_user: User = Depends(get_current_user),
):
    print(f"--- TRANSCRIPTION REQUEST RECEIVED ---", flush=True)
    print(f"User: {current_user.username}, Model: {model_size}, Source: {'File' if file else 'YouTube'}", flush=True)

    if processing_lock.locked():
        print("Blocked: Lock is currently held by another process.", flush=True)
        raise HTTPException(
            status_code=503,
            detail="System Busy: Another meeting is being processed. Please try again later.",
        )

    async with processing_lock:
        if not file and not youtube_url:
            raise HTTPException(status_code=400, detail="Please provide either a file or a YouTube URL.")

        temp_audio_path = None
        original_filename = "Unknown"

        try:
            # 1) Prepare audio source
            if youtube_url:
                print(f"Downloading YouTube URL: {youtube_url}", flush=True)
                temp_audio_path, video_title = download_youtube_audio(youtube_url)
                safe_title = "".join([c for c in video_title if c.isalnum() or c in (" ", ".", "_")]).replace(" ", "_")
                original_filename = f"{safe_title}.m4a"
            else:
                original_filename = file.filename or "uploaded_audio"
                temp_audio_path = f"temp_{original_filename}"
                print(f"Saving uploaded file to {temp_audio_path}...", flush=True)
                with open(temp_audio_path, "wb") as f:
                    content = await file.read()
                    f.write(content)
                    print(f"File saved. Size: {len(content)} bytes", flush=True)

            # 2) Faster-Whisper Pipeline
            from faster_whisper import WhisperModel
            device = "cuda" if torch.cuda.is_available() else "cpu"

            if device == "cuda":
                torch.cuda.empty_cache()
                torch.cuda.synchronize()

            compute_type = "float16" if (model_size == "large-v3" and device == "cuda") else "int8"

            print(f"Loading faster-whisper model {model_size} on {device} ({compute_type})...", flush=True)
            model = WhisperModel(model_size, device=device, compute_type=compute_type)

            print("Starting Inference (transcribe)...", flush=True)
            segments, info = model.transcribe(temp_audio_path, beam_size=5)

            result_segments = []
            for segment in segments:
                # Iterate so segments actually generate (it's a generator)
                result_segments.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "speaker": "Speaker"
                })
                # Mini-log for progress
                if len(result_segments) % 10 == 0:
                    print(f"Transcribed {len(result_segments)} segments...", flush=True)

            print(f"Inference complete. Total segments: {len(result_segments)}", flush=True)

            del model
            gc.collect()
            if device == "cuda":
                torch.cuda.empty_cache()
                torch.cuda.synchronize()

            # 3) Format output
            formatted_result = []
            for seg in result_segments:
                formatted_result.append(
                    {
                        "start": format_timestamp(seg.get("start", 0)),
                        "end": format_timestamp(seg.get("end", 0)),
                        "text": (seg.get("text", "") or "").strip(),
                        "speaker": "Speaker",
                    }
                )

            # 4) Archive per user
            try:
                date_prefix = meeting_date if meeting_date else datetime.now().strftime("%Y-%m-%d")
                time_suffix = datetime.now().strftime("%H-%M-%S")
                safe_filename = "".join([c for c in original_filename if c.isalnum() or c in (" ", ".", "_")]).replace(" ", "_")

                user_dir = get_user_archive_dir(current_user.username)
                archive_path = os.path.join(user_dir, f"{date_prefix}_{time_suffix}_{safe_filename}.json")

                with open(archive_path, "w", encoding="utf-8") as f:
                    json.dump(formatted_result, f, indent=2, ensure_ascii=False)

                print(f"Successfully archived to: {archive_path}", flush=True)
            except Exception as e:
                print(f"Archive failed: {e}", flush=True)

            return {"transcription": formatted_result}

        except Exception as e:
            import traceback
            print(f"CRITICAL ERROR: {e}", flush=True)
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

        finally:
            if temp_audio_path and os.path.exists(temp_audio_path):
                try:
                    os.remove(temp_audio_path)
                    print(f"Cleaned up temp file: {temp_audio_path}", flush=True)
                except Exception:
                    pass


# ─────────────────────────────────────────────
# Export endpoints
# ─────────────────────────────────────────────
@app.post("/api/download-pdf")
async def download_pdf(transcription_data: List[TranscriptionSegment], clean: bool = False):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = [Paragraph("Meeting Minutes" if clean else "Transcription", styles["h1"]), Spacer(1, 20)]

    if clean:
        block = []
        for i, segment in enumerate(transcription_data):
            block.append(segment.text.strip())
            if (i + 1) % 5 == 0:
                story.append(Paragraph(" ".join(block), styles["Normal"]))
                story.append(Spacer(1, 10))
                block = []
        if block:
            story.append(Paragraph(" ".join(block), styles["Normal"]))
    else:
        for segment in transcription_data:
            story.append(Paragraph(f"<b>[{segment.start}] {segment.speaker}:</b> {segment.text}", styles["Normal"]))
            story.append(Spacer(1, 10))

    doc.build(story)
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="minutes.pdf"'},
    )


@app.post("/api/download-docx")
async def download_docx(transcription_data: List[TranscriptionSegment], clean: bool = False):
    document = Document()
    document.add_heading("Meeting Minutes" if clean else "Transcription", 1)

    if clean:
        block = []
        for i, segment in enumerate(transcription_data):
            block.append(segment.text.strip())
            if (i + 1) % 5 == 0:
                document.add_paragraph(" ".join(block))
                block = []
        if block:
            document.add_paragraph(" ".join(block))
    else:
        for segment in transcription_data:
            document.add_paragraph(f"[{segment.start}] {segment.speaker}: {segment.text}")

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="minutes.docx"'},
    )


# ─────────────────────────────────────────────
# Static frontend hosting (React build)
# ─────────────────────────────────────────────
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static/static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        if full_path.startswith("api"):
            return {"error": "API route not found"}
        return FileResponse("static/index.html")
else:
    print("Warning: 'static' directory not found. Frontend will not be served.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
