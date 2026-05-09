from pathlib import Path
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

try:
    from backend.core.ai_engine import ask_ai_with_fallback_and_provider
except ImportError:
    from core.ai_engine import ask_ai_with_fallback_and_provider


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
BACKEND_DIR = BASE_DIR / "backend"

# Ưu tiên load biến môi trường từ backend/.env cho local development.
load_dotenv(BACKEND_DIR / ".env", override=True)
load_dotenv(BASE_DIR / ".env", override=False)

# Khởi tạo ứng dụng FastAPI cho cả API và static frontend.
app = FastAPI(title="SGU Grade Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    # Trả trạng thái sống của backend.
    return JSONResponse({
        "status": "ok",
        "mode": "frontend-pdf-parser",
        "message": "Backend đang để trống cho các tính năng AI ở bước tiếp theo.",
    })


@app.get("/health")
async def legacy_health():
    # Giữ endpoint cũ để tương thích ngược.
    return await health()


@app.get("/api/ai/status")
async def ai_status():
    # Báo trạng thái module AI hiện tại.
    return JSONResponse({
        "status": "idle",
        "provider_order": os.getenv("AI_PROVIDER_ORDER", "gemini,groq"),
        "has_gemini_key": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "has_groq_key": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "message": "AI backend sẵn sàng. Dùng fallback provider theo cấu hình môi trường.",
    })


class ChatTurn(BaseModel):
    role: str = Field(default="user")
    content: str = Field(default="")


class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)


@app.post("/api/ai/chat")
async def ai_chat(payload: ChatRequest):
    message = (payload.message or "").strip()
    if not message:
        return JSONResponse({"error": "Nội dung tin nhắn trống."}, status_code=400)

    history = [{"role": item.role, "content": item.content} for item in payload.history]

    try:
        reply, provider_used = ask_ai_with_fallback_and_provider(message, history)
        return JSONResponse({"reply": reply, "provider_used": provider_used})
    except Exception as error:
        return JSONResponse(
            {"error": f"Lỗi gọi AI: {error}"},
            status_code=500,
        )


if FRONTEND_DIR.exists():
    # Mount frontend để chạy chung một server.
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
