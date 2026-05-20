#!/usr/bin/env python3
"""Integration test for AI workflow using clawbot library."""

from clawbot import ClawBotClient


def test_ai_workflow() -> None:
    client = ClawBotClient()
    status = client.ai.status.get_status()
    assert isinstance(status, dict)


if __name__ == "__main__":
    test_ai_workflow()
    print("AI workflow integration smoke test passed")
