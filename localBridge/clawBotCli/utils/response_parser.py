"""Compatibility helpers for legacy response validation.

Deprecated: new parsing logic should live under `clawbot.domain`.
This module remains only for old tests/scripts during migration.
"""

from __future__ import annotations

from typing import Any, Dict, List


def is_twitter_raw_response(data: Any) -> bool:
    if not isinstance(data, dict):
        return False

    twitter_indicators = {
        "data",
        "legacy",
        "rest_id",
        "__typename",
        "tweet_results",
        "user_results",
        "threaded_conversation_with_injections_v2",
        "home_timeline_urt",
        "instructions",
        "entries",
    }

    def check_nested(obj: Any, depth: int = 0) -> bool:
        if depth > 3:
            return False
        if isinstance(obj, dict):
            if any(key in twitter_indicators for key in obj.keys()):
                return True
            return any(check_nested(value, depth + 1) for value in obj.values())
        if isinstance(obj, list) and obj:
            return check_nested(obj[0], depth + 1)
        return False

    return check_nested(data)


def validate_response(response: Dict[Any, Any], expected_fields: List[str] | None = None) -> tuple[bool, str]:
    if "error" in response:
        return False, f"Error: {response['error']}"
    if not is_twitter_raw_response(response):
        return False, "Response does not contain Twitter raw data structure"
    if expected_fields:
        missing = [field for field in expected_fields if field not in response]
        if missing:
            return False, f"Missing expected fields: {', '.join(missing)}"
    return True, "Valid Twitter raw response"


def print_response_summary(response: Dict[Any, Any], max_depth: int = 2):
    def summarize(obj: Any, depth: int = 0, prefix: str = "") -> List[str]:
        if depth >= max_depth:
            return [f"{prefix}..."]
        lines: List[str] = []
        if isinstance(obj, dict):
            for key, value in list(obj.items())[:5]:
                if isinstance(value, (dict, list)):
                    lines.append(f"{prefix}{key}:")
                    lines.extend(summarize(value, depth + 1, prefix + "  "))
                else:
                    lines.append(f"{prefix}{key}: {type(value).__name__}")
            if len(obj) > 5:
                lines.append(f"{prefix}... ({len(obj) - 5} more keys)")
        elif isinstance(obj, list) and obj:
            lines.append(f"{prefix}[{len(obj)} items]")
            if isinstance(obj[0], (dict, list)):
                lines.extend(summarize(obj[0], depth + 1, prefix + "  "))
        return lines

    print("\nResponse Structure:")
    for line in summarize(response):
        print(line)
