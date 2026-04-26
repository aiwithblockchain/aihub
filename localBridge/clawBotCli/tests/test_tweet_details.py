#!/usr/bin/env python3
"""
Live tweet detail and replies smoke test.

Focus:
- verify canonical single-tweet path returns the focal tweet for the requested id
- verify replies extraction excludes the focal tweet itself
- support explicit or auto-selected instanceId
"""
import argparse
import json
import os
import sys
from typing import Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def resolve_instance_id(client: ClawBotClient, preferred_instance_id: Optional[str]) -> Optional[str]:
    if preferred_instance_id:
        print(f"Using explicit instanceId: {preferred_instance_id}")
        return preferred_instance_id

    instances_payload: Any = client.x_transport.get_instances_raw()
    if isinstance(instances_payload, dict):
        instances = instances_payload.get("instances") or []
    elif isinstance(instances_payload, list):
        instances = instances_payload
    else:
        instances = []

    if not instances:
        print("No connected instances found, continuing without instanceId")
        return None

    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")
    if not instance_id:
        print("First instance has no instanceId, continuing without instanceId")
        return None

    print(f"Auto-selected first instanceId: {instance_id}")
    return str(instance_id)


def print_json_preview(label: str, payload: Any, limit: int = 1000) -> None:
    preview = json.dumps(payload, indent=2, ensure_ascii=False)
    if len(preview) > limit:
        preview = preview[:limit] + "..."
    print(f"{label}:\n{preview}")


def extract_tweet_id_from_timeline(client: ClawBotClient, tab_id: Optional[int]) -> Optional[str]:
    print("\n📋 Extracting tweet ID from timeline...")
    tweet = client.x.timeline.get_first_timeline_tweet(tab_id=tab_id)
    if tweet and tweet.id:
        print(f"✅ Found tweet ID: {tweet.id}")
        return tweet.id
    print("⚠️  No tweets found in timeline")
    return None


def test_get_tweet(client: ClawBotClient, tweet_id: str, instance_id: Optional[str], tab_id: Optional[int]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/tweets?tweetId=...")
    print("=" * 60)

    raw = client.x.tweets.get_tweet_raw(tweet_id, tab_id=tab_id, instance_id=instance_id)
    tweet = client.x.tweets.get_tweet(tweet_id, tab_id=tab_id, instance_id=instance_id)

    print_json_preview("Raw TweetDetail preview", raw)
    print(f"Structured tweet id: {tweet.id}")
    print(f"Structured tweet text: {tweet.text[:120] if tweet.text else '(no text)'}")
    print(f"Structured author: @{tweet.author_screen_name or 'N/A'}")

    if tweet.id != tweet_id:
        print(f"❌ Focal tweet mismatch, expected {tweet_id}, got {tweet.id}")
        return False

    raw_str = str(raw)
    if "threaded_conversation_with_injections_v2" not in raw_str:
        print("❌ Response is missing TweetDetail conversation structure")
        return False

    print("✅ Focal tweet extraction matched requested tweet_id")
    return True


def test_get_tweet_replies(client: ClawBotClient, tweet_id: str, instance_id: Optional[str], tab_id: Optional[int]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/tweets/{tweetId}/replies")
    print("=" * 60)

    raw = client.x.tweets.transport.get_tweet_replies_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id)
    replies = client.x.tweets.get_tweet_replies(tweet_id, tab_id=tab_id, instance_id=instance_id)

    print_json_preview("Raw replies preview", raw)
    print(f"Retrieved {len(replies)} structured replies")
    if replies:
        first = replies[0]
        print(f"First reply id: {first.id}")
        print(f"First reply text: {first.text[:120] if first.text else '(no text)'}")
        print(f"First reply author: @{first.author_screen_name or 'N/A'}")

    bad_ids = [reply.id for reply in replies if reply.id == tweet_id]
    if bad_ids:
        print("❌ Replies list incorrectly contains the focal tweet itself")
        return False

    raw_str = str(raw)
    if "threaded_conversation_with_injections_v2" not in raw_str:
        print("❌ Replies response is missing TweetDetail conversation structure")
        return False

    print("✅ Replies extraction excludes focal tweet and parsed successfully")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Run tweet detail and replies smoke tests")
    parser.add_argument("--tweet-id", type=str, help="Tweet ID to test")
    parser.add_argument("--instance-id", type=str, help="Explicit instanceId")
    parser.add_argument("--tab-id", type=int, help="Optional tabId")
    parser.add_argument("--only", choices=["tweet", "replies"], help="Run only one sub-test")
    args = parser.parse_args()

    print("\n🧪 Testing Tweet Details APIs")
    print("=" * 60)

    client = ClawBotClient()
    resolved_instance_id = resolve_instance_id(client, args.instance_id)
    tweet_id = args.tweet_id or extract_tweet_id_from_timeline(client, args.tab_id)

    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return 0

    results = []
    if args.only in (None, "tweet"):
        results.append(("Get Tweet", test_get_tweet(client, tweet_id, resolved_instance_id, args.tab_id)))
    if args.only in (None, "replies"):
        results.append(("Get Tweet Replies", test_get_tweet_replies(client, tweet_id, resolved_instance_id, args.tab_id)))

    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    passed_count = sum(1 for _, passed in results if passed)
    print(f"\nTotal: {passed_count}/{len(results)} tests passed")
    return 0 if all(passed for _, passed in results) else 1


if __name__ == "__main__":
    sys.exit(main())
