#!/usr/bin/env python3
"""
Test Like and Retweet APIs (Like, Unlike, Retweet, Unretweet)
测试场景 6: 点赞和转发测试
"""
import sys
import os
import json
import time
import argparse
from typing import Any, Optional

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


def extract_tweet_id_from_timeline(instance_id: Optional[str]) -> Optional[str]:
    """Extract a tweet ID from timeline for testing"""
    print("\n📋 Extracting tweet ID from timeline...")
    client = ClawBotClient()
    tweet = client.x.timeline.get_first_timeline_tweet(instance_id=instance_id)

    if tweet and tweet.id:
        print(f"✅ Found tweet ID: {tweet.id}")
        return tweet.id

    print(f"⚠️  No tweets found in timeline")
    return None


def test_like_unlike(instance_id: Optional[str], assume_yes: bool) -> bool:
    """Test POST /api/v1/x/likes and /api/v1/x/unlikes"""
    print("\n" + "="*60)
    print("Testing: Like and Unlike Tweet")
    print("="*60)

    tweet_id = extract_tweet_id_from_timeline(instance_id=instance_id)
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print(f"Using instance_id: {instance_id}")
    confirm_or_exit("⚠️  This will like and then unlike a real tweet!", assume_yes)

    client = ClawBotClient()

    # Test like
    print("\n📍 Testing like...")
    result = client.x.actions.like(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Like successful")
    else:
        print("❌ Like failed")
        return False

    time.sleep(2)

    # Test unlike
    print("\n📍 Testing unlike...")
    result = client.x.actions.unlike(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unlike successful")
        return True
    else:
        print("❌ Unlike failed")
        return False


def test_retweet_unretweet(instance_id: Optional[str], assume_yes: bool) -> bool:
    """Test POST /api/v1/x/retweets and /api/v1/x/unretweets"""
    print("\n" + "="*60)
    print("Testing: Retweet and Unretweet")
    print("="*60)

    tweet_id = extract_tweet_id_from_timeline(instance_id=instance_id)
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print(f"Using instance_id: {instance_id}")
    confirm_or_exit("⚠️  This will retweet and then unretweet a real tweet!", assume_yes)

    client = ClawBotClient()

    # Test retweet
    print("\n📍 Testing retweet...")
    result = client.x.actions.retweet(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Retweet successful")
    else:
        print("❌ Retweet failed")
        return False

    time.sleep(2)

    # Test unretweet
    print("\n📍 Testing unretweet...")
    result = client.x.actions.unretweet(tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unretweet successful")
        return True
    else:
        print("❌ Unretweet failed")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test like/unlike and retweet/unretweet on X')
    parser.add_argument('--instance-id', type=str, help='Explicit instanceId for multi-instance routing')
    parser.add_argument('--yes', action='store_true', help='Skip interactive confirmation')
    args = parser.parse_args()

    print("\n🧪 Testing Like and Retweet APIs (Scenario 6)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    bootstrap_client = ClawBotClient()
    instance_id = resolve_instance_id(bootstrap_client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")

    results = []
    results.append(("Like/Unlike", test_like_unlike(instance_id=instance_id, assume_yes=args.yes)))
    results.append(("Retweet/Unretweet", test_retweet_unretweet(instance_id=instance_id, assume_yes=args.yes)))

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
