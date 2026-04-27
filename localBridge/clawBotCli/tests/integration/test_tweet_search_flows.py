#!/usr/bin/env python3
"""Integration smoke tests for tweet details and search flows."""

from typing import Any, Optional

from clawbot import ClawBotClient


def resolve_instance_id(client: ClawBotClient, preferred_instance_id: Optional[str] = None) -> Optional[str]:
    if preferred_instance_id:
        return preferred_instance_id

    instances_payload: Any = client.x.status.get_instances()
    if isinstance(instances_payload, dict):
        instances = instances_payload.get("instances") or []
    elif isinstance(instances_payload, list):
        instances = instances_payload
    else:
        instances = []

    if not instances:
        return None

    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")
    return str(instance_id) if instance_id else None


def test_tweet_detail_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    first = client.x.timeline.get_first_timeline_tweet(instance_id=instance_id)
    if first and first.id:
        detail = client.x.tweets.get_tweet(first.id, instance_id=instance_id)
        assert detail is not None


def test_search_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    tweets = client.x.search.search_tweets("AI", count=1, instance_id=instance_id)
    assert isinstance(tweets, list)


if __name__ == "__main__":
    test_tweet_detail_smoke()
    test_search_smoke()
    print("Tweet/search integration smoke tests passed")
