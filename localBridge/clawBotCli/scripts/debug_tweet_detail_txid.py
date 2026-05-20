#!/usr/bin/env python3
"""Minimal tweet detail trigger for txid/runtime debugging."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from clawbot import ClawBotClient


DEFAULT_BASE_URL = "http://127.0.0.1:10088"
DEFAULT_TIMEOUT = 30
DEFAULT_TWEET_ID = "2044445898680185190"


def resolve_instance_id(client: ClawBotClient, preferred_instance_id: str | None) -> str:
    if preferred_instance_id:
        return preferred_instance_id

    instances_payload: Any = client.x_transport.get_instances_raw()
    if isinstance(instances_payload, dict):
        instances = instances_payload.get("instances") or []
    elif isinstance(instances_payload, list):
        instances = instances_payload
    else:
        instances = []

    if not instances:
        raise RuntimeError("No tweetClaw instances found")

    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")
    if not instance_id:
        raise RuntimeError("First instance has no instanceId")
    return str(instance_id)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Trigger one minimal LocalBridge tweet detail read for debugging."
    )
    parser.add_argument(
        "--tweet-id",
        default=DEFAULT_TWEET_ID,
        help=f"Tweet ID to fetch, default: {DEFAULT_TWEET_ID}",
    )
    parser.add_argument(
        "--instance-id",
        default=None,
        help="Target tweetClaw instanceId. If omitted, auto-pick the first instance.",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"LocalBridge base URL, default: {DEFAULT_BASE_URL}",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"Request timeout in seconds, default: {DEFAULT_TIMEOUT}",
    )
    args = parser.parse_args()

    client = ClawBotClient(base_url=args.base_url, timeout=args.timeout)

    try:
        instance_id = resolve_instance_id(client, args.instance_id)
    except Exception as exc:
        print("ERROR")
        print(f"Failed to resolve instanceId: {exc}")
        return 1

    print(f"[debug] requesting tweet detail: tweetId={args.tweet_id}")
    print(f"[debug] instanceId={instance_id}")
    print(f"[debug] base_url={args.base_url} timeout={args.timeout}s")

    try:
        data = client.x_transport.request_json(
            "GET",
            "/api/v1/x/tweets",
            params={
                "tweetId": args.tweet_id,
                "instanceId": instance_id,
            },
        )
        print("SUCCESS")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print("ERROR")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
