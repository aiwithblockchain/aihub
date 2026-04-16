#!/usr/bin/env python3
"""Integration smoke tests for status and metadata flows."""

from clawbot import ClawBotClient


def test_status_smoke() -> None:
    client = ClawBotClient()
    status = client.x.status.get_status()
    assert hasattr(status, "tabs")


def test_metadata_smoke() -> None:
    client = ClawBotClient()
    docs = client.x.status.get_docs_raw()
    assert docs is not None


if __name__ == "__main__":
    test_status_smoke()
    test_metadata_smoke()
    print("Status/metadata integration smoke tests passed")
