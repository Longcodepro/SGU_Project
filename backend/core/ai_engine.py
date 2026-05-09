import os
from typing import List, Dict, Any

import requests


GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-1.5-flash"
GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"


def _to_gemini_contents(history: List[Dict[str, str]], user_message: str) -> List[Dict[str, Any]]:
    contents: List[Dict[str, Any]] = []

    for item in history or []:
        role = "model" if item.get("role") == "assistant" else "user"
        text = str(item.get("content") or "").strip()
        if not text:
            continue
        contents.append({
            "role": role,
            "parts": [{"text": text}],
        })

    contents.append({
        "role": "user",
        "parts": [{"text": user_message}],
    })

    return contents


def ask_gemini(user_message: str, history: List[Dict[str, str]] | None = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Thiếu GEMINI_API_KEY trong môi trường backend.")

    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={api_key}"

    payload = {
        "system_instruction": {
            "parts": [
                {
                    "text": (
                        "Bạn là trợ lý học tập thân thiện cho sinh viên SGU. "
                        "Trả lời ngắn gọn, rõ ràng, dễ hiểu, ưu tiên tiếng Việt."
                    )
                }
            ]
        },
        "contents": _to_gemini_contents(history or [], user_message),
    }

    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        return "Mình chưa nhận được phản hồi từ Gemini. Bạn thử lại nhé."

    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    text_chunks = [str(part.get("text") or "").strip() for part in parts if part.get("text")]
    answer = "\n".join([chunk for chunk in text_chunks if chunk]).strip()
    return answer or "Mình chưa nhận được phản hồi rõ ràng từ Gemini."


def _to_openai_messages(history: List[Dict[str, str]], user_message: str) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "Bạn là trợ lý học tập thân thiện cho sinh viên SGU. "
                "Trả lời ngắn gọn, rõ ràng, dễ hiểu, ưu tiên tiếng Việt."
            ),
        }
    ]

    for item in history or []:
        role = "assistant" if item.get("role") == "assistant" else "user"
        text = str(item.get("content") or "").strip()
        if not text:
            continue
        messages.append({"role": role, "content": text})

    messages.append({"role": "user", "content": user_message})
    return messages


def ask_groq(user_message: str, history: List[Dict[str, str]] | None = None) -> str:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Thiếu GROQ_API_KEY trong môi trường backend.")

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    payload = {
        "model": model,
        "messages": _to_openai_messages(history or [], user_message),
        "temperature": 0.5,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    response = requests.post(GROQ_API_BASE, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        return "Mình chưa nhận được phản hồi từ Groq. Bạn thử lại nhé."
    text = (((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    return text or "Mình chưa nhận được phản hồi rõ ràng từ Groq."


def ask_ai_with_fallback(user_message: str, history: List[Dict[str, str]] | None = None) -> str:
    provider_order = os.getenv("AI_PROVIDER_ORDER", "gemini,groq").split(",")
    providers = [item.strip().lower() for item in provider_order if item.strip()]
    errors: List[str] = []

    for provider in providers:
        try:
            if provider == "gemini":
                return ask_gemini(user_message, history)
            if provider == "groq":
                return ask_groq(user_message, history)
            errors.append(f"provider không hỗ trợ: {provider}")
        except Exception as error:
            errors.append(f"{provider}: {error}")

    raise RuntimeError(" ; ".join(errors) if errors else "Không có provider AI khả dụng.")


def ask_ai_with_fallback_and_provider(user_message: str, history: List[Dict[str, str]] | None = None) -> tuple[str, str]:
    provider_order = os.getenv("AI_PROVIDER_ORDER", "gemini,groq").split(",")
    providers = [item.strip().lower() for item in provider_order if item.strip()]
    errors: List[str] = []

    for provider in providers:
        try:
            if provider == "gemini":
                return ask_gemini(user_message, history), "gemini"
            if provider == "groq":
                return ask_groq(user_message, history), "groq"
            errors.append(f"provider không hỗ trợ: {provider}")
        except Exception as error:
            errors.append(f"{provider}: {error}")

    raise RuntimeError(" ; ".join(errors) if errors else "Không có provider AI khả dụng.")
