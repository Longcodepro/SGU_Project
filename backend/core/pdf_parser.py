"""
Frontend now owns PDF parsing.

This module is intentionally left as a placeholder so backend AI features can
consume normalized JSON in a later step without also handling raw PDF parsing.
"""


def extract_grades_from_pdf(*_args, **_kwargs):
    # Parser backend đã ngừng sử dụng, giữ hàm để báo lỗi rõ ràng.
    raise NotImplementedError(
        "PDF parsing đã được chuyển sang frontend. Hãy gửi JSON đã chuẩn hóa lên backend."
    )
