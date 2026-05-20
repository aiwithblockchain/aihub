#!/usr/bin/env python3
"""Integration smoke tests for workflow-style operations."""

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


def test_workflow_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    status = client.x.status.get_status(instance_id=instance_id)
    assert hasattr(status, "is_logged_in")


def test_search_smoke() -> None:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)
    results = client.x.search.search("AI", count=1, instance_id=instance_id)
    assert isinstance(results, tuple)


if __name__ == "__main__":
    test_workflow_smoke()
    test_search_smoke()
    print("Workflow integration smoke tests passed")
