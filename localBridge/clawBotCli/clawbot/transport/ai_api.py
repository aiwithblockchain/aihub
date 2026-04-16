"""Raw REST mappings for AI platform operations."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .base import BaseApiTransport


class AIApiTransport(BaseApiTransport):
    def get_status_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ai/status")

    def send_message_raw(self, platform: str, prompt: str, conversation_id: Optional[str] = None) -> Dict[Any, Any]:
        payload = {"platform": platform, "prompt": prompt}
        if conversation_id:
            payload["conversationId"] = conversation_id
        return self.request_json("POST", "/api/v1/ai/message", json=payload)

    def new_conversation_raw(self, platform: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ai/new_conversation", json={"platform": platform})

    def navigate_platform_raw(self, platform: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ai/navigate", json={"platform": platform})
