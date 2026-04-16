"""Result helpers for clawbot domain layer."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .models import ActionResult


def build_action_result(action: str, raw: Dict[str, Any], target_id: Optional[str] = None) -> ActionResult:
    success = "error" not in raw
    message = raw.get("error") if isinstance(raw, dict) else None
    return ActionResult(success=success, action=action, target_id=target_id, message=message, raw=raw)
