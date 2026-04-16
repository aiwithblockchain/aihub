#!/usr/bin/env python3
"""Integration smoke tests for workflow-style operations."""

from clawbot import ClawBotClient


def test_workflow_smoke() -> None:
    client = ClawBotClient()
    status = client.x.status.get_status()
    assert hasattr(status, "is_logged_in")


def test_search_smoke() -> None:
    client = ClawBotClient()
    users = client.x.search.search("AI", count=1)
    assert isinstance(users, tuple)


if __name__ == "__main__":
    test_workflow_smoke()
    test_search_smoke()
    print("Workflow integration smoke tests passed")
