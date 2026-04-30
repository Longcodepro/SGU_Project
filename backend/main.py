from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

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
        "message": "Chưa có logic AI trên backend. Frontend đang tự đọc PDF và lưu dữ liệu cục bộ.",
    })


if FRONTEND_DIR.exists():
    # Mount frontend để chạy chung một server.
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
