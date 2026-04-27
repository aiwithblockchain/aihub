#!/usr/bin/env python3
"""Example showing optional multi-instance routing via clawbot."""

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


def main() -> int:
    client = ClawBotClient()

    print("\nMulti-instance clawbot example")
    print("=" * 60)
    print("Legacy calls still work when your bridge has a single target.")
    print("Use instance_id when you want to route explicitly in multi-instance mode.\n")

    instance_id = resolve_instance_id(client)
    print(f"Selected instance_id: {instance_id}")

    status = client.x.status.get_status(instance_id=instance_id)
    print(f"Logged in: {status.is_logged_in}")
    print(f"Open tabs on selected instance: {len(status.tabs)}")

    tweets, users = client.x.search.search("AI", count=1, instance_id=instance_id)
    print(f"Search results: {len(tweets)} tweet(s), {len(users)} user(s)")

    tab = client.x.tabs.open("home", instance_id=instance_id)
    print(f"Opened tab on selected instance: {tab.tab_id}")

    if tab.tab_id is not None:
        navigate_result = client.x.tabs.navigate("notifications", tab.tab_id, instance_id=instance_id)
        print(f"Navigate result: {navigate_result}")

        close_result = client.x.tabs.close(tab.tab_id, instance_id=instance_id)
        print(f"Close result: {close_result}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
