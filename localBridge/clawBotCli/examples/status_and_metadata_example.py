#!/usr/bin/env python3
"""Example focused on status and metadata reads via clawbot."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🧪 Status and metadata example")
    print("=" * 60)

    docs = client.x.status.get_docs_raw()
    if isinstance(docs, list):
        print(f"API docs count: {len(docs)}")

    status = client.x.status.get_status()
    print(f"Logged in: {status.is_logged_in}")
    print(f"Open tabs: {len(status.tabs)}")

    instances = client.x.status.get_instances()
    if isinstance(instances, list):
        print(f"Instances: {len(instances)}")

    basic = client.x.status.get_basic_info()
    print(f"Basic user: @{basic.screen_name} / {basic.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
