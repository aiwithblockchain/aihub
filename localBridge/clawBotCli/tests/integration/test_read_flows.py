#!/usr/bin/env python3
"""Integration smoke tests for read flows using clawbot library."""

from clawbot import ClawBotClient


def test_timeline_smoke() -> None:
    client = ClawBotClient()
    tweets = client.x.timeline.list_timeline_tweets()
    assert isinstance(tweets, list)


def test_user_smoke() -> None:
    client = ClawBotClient()
    user = client.x.users.get("elonmusk")
    assert user is not None


if __name__ == "__main__":
    test_timeline_smoke()
    test_user_smoke()
    print("Read integration smoke tests passed")
