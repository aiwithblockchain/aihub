"""Result helpers for clawbot domain layer."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .models import ActionResult


def build_action_result(action: str, raw: Dict[str, Any], target_id: Optional[str] = None) -> ActionResult:
    success = False
    message = None

    if isinstance(raw, dict):
        if "success" in raw:
            success = bool(raw.get("success"))
        else:
            success = "error" not in raw
        message = raw.get("error") or raw.get("reason")

    return ActionResult(success=success, action=action, target_id=target_id, message=message, raw=raw)
