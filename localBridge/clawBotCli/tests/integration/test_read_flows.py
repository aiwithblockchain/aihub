#!/usr/bin/env python3
"""Integration smoke tests for read flows using clawbot library."""

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


def test_timeline_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    tweets = client.x.timeline.list_timeline_tweets(instance_id=instance_id)
    assert isinstance(tweets, list)


def test_user_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    user = client.x.users.get_user("elonmusk", instance_id=instance_id)
    assert user is not None
    assert user.id is not None


if __name__ == "__main__":
    test_timeline_smoke()
    test_user_smoke()
    print("Read integration smoke tests passed")
