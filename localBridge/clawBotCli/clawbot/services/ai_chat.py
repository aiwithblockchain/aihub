"""Service layer for AI chat operations."""

from __future__ import annotations

from typing import Any, Dict, List

from clawbot.domain.ai_parsers import parse_ai_message
from clawbot.domain.result import build_action_result
from clawbot.transport.ai_api import AIApiTransport


class AIChatService:
    def __init__(self, transport: AIApiTransport):
        self.transport = transport

    def get_status(self) -> Dict[str, Any]:
        return self.transport.get_status_raw()

    def available_platforms(self) -> List[str]:
        status = self.get_status()
        platforms = status.get("platforms", {})
        return [name for name, info in platforms.items() if info.get("hasTab")]

    def logged_in_platforms(self) -> List[str]:
        status = self.get_status()
        platforms = status.get("platforms", {})
        return [name for name, info in platforms.items() if info.get("isLoggedIn")]

    def new_conversation(self, platform: str):
        return build_action_result("new_ai_conversation", self.transport.new_conversation_raw(platform), target_id=platform)

    def navigate(self, platform: str):
        return build_action_result("navigate_ai_platform", self.transport.navigate_platform_raw(platform), target_id=platform)

    def send_message(self, platform: str, prompt: str, conversation_id: str | None = None):
        raw = self.transport.send_message_raw(platform=platform, prompt=prompt, conversation_id=conversation_id)
        return parse_ai_message(raw, platform=platform)

    def ask(self, platform: str, prompt: str, conversation_id: str | None = None) -> str | None:
        result = self.send_message(platform=platform, prompt=prompt, conversation_id=conversation_id)
        return result.content
