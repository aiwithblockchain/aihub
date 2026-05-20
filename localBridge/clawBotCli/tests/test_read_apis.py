#!/usr/bin/env python3
"""
Live read API smoke tests for clawBotCli.

Goals:
- support explicit instance selection for single-tweet checks
- verify structured focal tweet extraction against requested tweet_id
- keep each sub-test independently skippable
"""
import argparse
import json
import os
import sys
from typing import Any, Optional

# Add parent directory to path
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


def prompt_if_missing(value: Optional[str], prompt: str, default: Optional[str] = None) -> Optional[str]:
    if value:
        return value
    try:
        entered = input(prompt).strip()
    except EOFError:
        return default
    return entered or default


def print_json_preview(label: str, payload: Any, limit: int = 800) -> None:
    preview = json.dumps(payload, indent=2, ensure_ascii=False)
    if len(preview) > limit:
        preview = preview[:limit] + "..."
    print(f"{label}:\n{preview}")


def test_timeline(client: ClawBotClient, tab_id: Optional[int]) -> tuple[bool, Optional[str]]:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/timeline")
    print("=" * 60)

    tweets = client.x.timeline.list_timeline_tweets(tab_id=tab_id)
    print(f"Found {len(tweets)} tweets")
    if tweets:
        first = tweets[0]
        print(f"First tweet id: {first.id}")
        print(f"First tweet text: {first.text[:120] if first.text else 'N/A'}")
        print("✅ Timeline fetched successfully")
        return True, first.id

    print("⚠️  No tweets found")
    return True, None


def test_get_tweet(client: ClawBotClient, tweet_id: Optional[str], instance_id: Optional[str], tab_id: Optional[int]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/tweets?tweetId=...")
    print("=" * 60)

    tweet_id = prompt_if_missing(tweet_id, "Enter a tweet ID to test (or press Enter to skip): ")
    if not tweet_id:
        print("⏭️  Skipped")
        return True

    raw = client.x.tweets.get_tweet_raw(tweet_id, tab_id=tab_id, instance_id=instance_id)
    tweet = client.x.tweets.get_tweet(tweet_id, tab_id=tab_id, instance_id=instance_id)

    print_json_preview("Raw TweetDetail preview", raw)
    print(f"Structured tweet id: {tweet.id}")
    print(f"Structured tweet text: {tweet.text[:120] if tweet.text else 'N/A'}")
    print(f"Structured author: @{tweet.author_screen_name or 'N/A'}")

    raw_str = str(raw)
    if "threaded_conversation_with_injections_v2" not in raw_str:
        print("❌ Raw payload is missing TweetDetail conversation structure")
        return False

    if tweet.id != tweet_id:
        print(f"❌ Focal tweet mismatch, expected {tweet_id}, got {tweet.id}")
        return False

    print("✅ Structured focal tweet matched requested tweet_id")
    return True


def test_user_profile(client: ClawBotClient, screen_name: Optional[str], tab_id: Optional[int]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/users")
    print("=" * 60)

    screen_name = prompt_if_missing(screen_name, "Enter a screen name to test (default: elonmusk): ", default="elonmusk")
    user = client.x.users.get_user(screen_name, tab_id=tab_id)

    if user and user.screen_name:
        print(f"✅ User profile fetched: @{user.screen_name} - {user.name}")
        return True

    print("❌ Failed to fetch user profile")
    return False


def test_search(client: ClawBotClient, query: Optional[str], tab_id: Optional[int]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/search")
    print("=" * 60)

    query = prompt_if_missing(query, "Enter search query (default: AI): ", default="AI")
    tweets, users = client.x.search.search(query, count=5, tab_id=tab_id)

    print(f"✅ Search completed: found {len(tweets)} tweets, {len(users)} users")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Run read API smoke tests for clawBotCli")
    parser.add_argument("--tweet-id", type=str, help="Tweet ID for single tweet test")
    parser.add_argument("--screen-name", type=str, help="Screen name for user profile test")
    parser.add_argument("--query", type=str, help="Search query")
    parser.add_argument("--instance-id", type=str, help="Explicit instanceId for single tweet checks")
    parser.add_argument("--tab-id", type=int, help="Optional tabId for read APIs")
    parser.add_argument("--only", choices=["timeline", "tweet", "user", "search"], help="Run only one sub-test")
    args = parser.parse_args()

    print("\n🧪 Testing Read APIs")
    print("=" * 60)

    client = ClawBotClient()
    resolved_instance_id = resolve_instance_id(client, args.instance_id)

    timeline_ok = True
    inferred_tweet_id: Optional[str] = None
    if args.only in (None, "timeline"):
        timeline_ok, inferred_tweet_id = test_timeline(client, args.tab_id)

    effective_tweet_id = args.tweet_id or inferred_tweet_id

    results = []
    if args.only in (None, "timeline"):
        results.append(("Timeline", timeline_ok))
    if args.only in (None, "tweet"):
        results.append(("Get Tweet", test_get_tweet(client, effective_tweet_id, resolved_instance_id, args.tab_id)))
    if args.only in (None, "user"):
        results.append(("User Profile", test_user_profile(client, args.screen_name, args.tab_id)))
    if args.only in (None, "search"):
        results.append(("Search", test_search(client, args.query, args.tab_id)))

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
