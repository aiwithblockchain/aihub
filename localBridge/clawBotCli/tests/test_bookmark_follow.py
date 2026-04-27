#!/usr/bin/env python3
"""
Test Bookmark and Follow APIs (Bookmark, Unbookmark, Follow, Unfollow)
测试场景 7: 收藏和关注测试
"""
import sys
import os
import json
import argparse
from typing import Any, Optional, Tuple

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


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


def extract_tweet_and_user_from_timeline(instance_id: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Extract a tweet ID and user ID from timeline for testing"""
    print("\n📋 Extracting tweet ID and user ID from timeline...")
    client = ClawBotClient()

    tweet = client.x.timeline.get_first_timeline_tweet(instance_id=instance_id)
    if not tweet:
        print(f"⚠️  No tweets found in timeline")
        return None, None

    tweet_id = tweet.id
    user_id = tweet.author_id

    if tweet_id and user_id:
        print(f"✅ Found tweet ID: {tweet_id}")
        print(f"✅ Found user ID: {user_id}")

    return tweet_id, user_id


def test_bookmark_unbookmark(instance_id: Optional[str], assume_yes: bool) -> bool:
    """Test POST /api/v1/x/bookmarks and /api/v1/x/unbookmarks"""
    print("\n" + "="*60)
    print("Testing: Bookmark and Unbookmark Tweet")
    print("="*60)

    tweet_id, _ = extract_tweet_and_user_from_timeline(instance_id=instance_id)
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print(f"Using instance_id: {instance_id}")
    confirm_or_exit("⚠️  This will bookmark and then unbookmark a real tweet!", assume_yes)

    client = ClawBotClient()

    print("\n📍 Testing bookmark...")
    result = client.x.actions.bookmark(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Bookmark successful")
    else:
        print("❌ Bookmark failed")
        return False

    import time
    time.sleep(2)

    print("\n📍 Testing unbookmark...")
    result = client.x.actions.unbookmark(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unbookmark successful")
        return True
    else:
        print("❌ Unbookmark failed")
        return False


def test_follow_unfollow(instance_id: Optional[str], assume_yes: bool) -> bool:
    """Test POST /api/v1/x/follows and /api/v1/x/unfollows"""
    print("\n" + "="*60)
    print("Testing: Follow and Unfollow User")
    print("="*60)

    _, user_id = extract_tweet_and_user_from_timeline(instance_id=instance_id)
    if not user_id:
        print("⏭️  Skipped - No user ID available")
        return True

    print(f"Using user ID: {user_id}")
    print(f"Using instance_id: {instance_id}")
    confirm_or_exit("⚠️  This will follow and then unfollow a real user!", assume_yes)

    client = ClawBotClient()

    print("\n📍 Testing follow...")
    result = client.x.actions.follow(user_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Follow successful")
    else:
        print("❌ Follow failed")
        return False

    import time
    time.sleep(2)

    print("\n📍 Testing unfollow...")
    result = client.x.actions.unfollow(user_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unfollow successful")
        return True
    else:
        print("❌ Unfollow failed")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test bookmark/unbookmark and follow/unfollow on X')
    parser.add_argument('--instance-id', type=str, help='Explicit instanceId for multi-instance routing')
    parser.add_argument('--yes', action='store_true', help='Skip interactive confirmation')
    args = parser.parse_args()

    print("\n🧪 Testing Bookmark and Follow APIs (Scenario 7)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    bootstrap_client = ClawBotClient()
    instance_id = resolve_instance_id(bootstrap_client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")

    results = []
    results.append(("Bookmark/Unbookmark", test_bookmark_unbookmark(instance_id=instance_id, assume_yes=args.yes)))
    results.append(("Follow/Unfollow", test_follow_unfollow(instance_id=instance_id, assume_yes=args.yes)))

    print("\n" + "="*60)
    print("Test Summary:")
    print("="*60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")

    sys.exit(0 if passed == total else 1)
