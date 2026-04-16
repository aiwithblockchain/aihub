"""Parsers for AI raw responses."""

from __future__ import annotations

from typing import Any, Dict

from clawbot.domain.models import AIMessageResult


def parse_ai_message(response: Dict[str, Any], platform: str | None = None) -> AIMessageResult:
    return AIMessageResult(
        success=bool(response.get("success", "error" not in response)),
        content=response.get("content"),
        conversation_id=response.get("conversationId"),
        platform=platform or response.get("platform"),
        raw=response,
    )
