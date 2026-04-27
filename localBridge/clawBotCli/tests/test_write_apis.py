#!/usr/bin/env python3
"""
Write API smoke tests for clawBotCli.

This script is designed for one action at a time.
Examples:
  python3 tests/test_write_apis.py --action create --yes
  python3 tests/test_write_apis.py --action like --tweet-id 123
  python3 tests/test_write_apis.py --action retweet --tweet-id 123
"""
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient

DEFAULT_TEXT = "[ClawBot test] Read/write regression check for LocalBridge + clawBotCli. Safe to ignore."


def build_default_text() -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"{DEFAULT_TEXT} ({timestamp})"


def print_json_preview(payload: object, limit: int = 800) -> None:
    preview = json.dumps(payload, indent=2, ensure_ascii=False)
    if len(preview) > limit:
        preview = preview[:limit] + "..."
    print(preview)


def confirm_or_exit(message: str, assume_yes: bool) -> None:
    print(message)
    if assume_yes:
        return
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        raise SystemExit(0)


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


def test_create_tweet(client: ClawBotClient, text: str, instance_id: Optional[str]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: POST /api/v1/x/tweets")
    print("=" * 60)
    print(f"Tweet text: {text}")
    print(f"instance_id: {instance_id}")

    result = client.x.actions.create_tweet(text=text, instance_id=instance_id)
    print_json_preview(result.raw)

    if result.success:
        print("✅ Tweet created successfully")
        print(f"Created tweet ID: {result.target_id or 'unknown'}")
        return True

    print("❌ Failed to create tweet")
    return False


def test_like_tweet(client: ClawBotClient, tweet_id: str, instance_id: Optional[str]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: POST /api/v1/x/likes")
    print("=" * 60)
    print(f"Target tweet ID: {tweet_id}")
    print(f"instance_id: {instance_id}")

    result = client.x.actions.like(tweet_id, instance_id=instance_id)
    print_json_preview(result.raw)

    if result.success:
        print("✅ Tweet liked successfully")
        return True

    print("❌ Failed to like tweet")
    return False


def test_retweet(client: ClawBotClient, tweet_id: str, instance_id: Optional[str]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: POST /api/v1/x/retweets")
    print("=" * 60)
    print(f"Target tweet ID: {tweet_id}")
    print(f"instance_id: {instance_id}")

    result = client.x.actions.retweet(tweet_id, instance_id=instance_id)
    print_json_preview(result.raw)

    if result.success:
        print("✅ Retweeted successfully")
        return True

    print("❌ Failed to retweet")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one write API smoke test at a time")
    parser.add_argument("--action", required=True, choices=["create", "like", "retweet"], help="Action to test")
    parser.add_argument("--tweet-id", type=str, help="Tweet ID for like/retweet")
    parser.add_argument("--text", type=str, help="Tweet text for create action")
    parser.add_argument("--instance-id", type=str, help="Explicit instanceId for multi-instance routing")
    parser.add_argument("--yes", action="store_true", help="Skip interactive confirmation")
    args = parser.parse_args()

    print("\n🧪 Testing Write APIs")
    print("=" * 60)
    print("⚠️  WARNING: This script performs one real action on your X account")
    print("=" * 60)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")

    if args.action == "create":
        text = args.text or build_default_text()
        confirm_or_exit("⚠️  This will post a real tweet to your account!", args.yes)
        passed = test_create_tweet(client, text, instance_id)
    else:
        tweet_id = args.tweet_id or input("Enter tweet ID to use: ").strip()
        if not tweet_id:
            print("⏭️  Skipped")
            return 0
        action_label = "like" if args.action == "like" else "retweet"
        confirm_or_exit(f"⚠️  This will perform a real {action_label} action on tweet {tweet_id}", args.yes)
        if args.action == "like":
            passed = test_like_tweet(client, tweet_id, instance_id)
        else:
            passed = test_retweet(client, tweet_id, instance_id)

    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    print(f"{'✅ PASS' if passed else '❌ FAIL'} - {args.action}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
