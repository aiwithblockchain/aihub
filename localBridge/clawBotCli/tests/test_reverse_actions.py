#!/usr/bin/env python3
"""
Test Reverse Actions (Unlike, Unretweet, Unbookmark, Unfollow)
测试场景 8: 取消点赞、取消转发、取消收藏和取消关注测试
"""
import sys
import json
import os
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


def load_actions_data():
    """Load actions data from test_actions.json"""
    json_path = os.path.join(os.path.dirname(__file__), '..', 'test_actions.json')

    if not os.path.exists(json_path):
        print(f"⚠️  File not found: {json_path}")
        print("   Please run test_actions.py first to generate the actions data.")
        return None

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded actions data from: {json_path}")
        print(f"   Data: {json.dumps(data, ensure_ascii=False)}")
        return data
    except Exception as e:
        print(f"❌ Failed to load actions data: {e}")
        return None


def test_reverse_actions(instance_id: Optional[str], assume_yes: bool):
    """Test all reverse actions: Unlike, Unretweet, Unbookmark, Unfollow"""
    print("\n" + "="*60)
    print("Testing: Reverse Actions (Unlike, Unretweet, Unbookmark, Unfollow)")
    print("="*60)

    actions_data = load_actions_data()
    if not actions_data:
        return False

    like_tweet_id = actions_data.get('like_tweet_id')
    retweet_tweet_id = actions_data.get('retweet_tweet_id')
    bookmark_tweet_id = actions_data.get('bookmark_tweet_id')
    follow_user_id = actions_data.get('follow_user_id')

    if not all([like_tweet_id, retweet_tweet_id, bookmark_tweet_id, follow_user_id]):
        print("❌ Missing required IDs in actions data")
        return False

    print(f"\nLike tweet ID: {like_tweet_id}")
    print(f"Retweet tweet ID: {retweet_tweet_id}")
    print(f"Bookmark tweet ID: {bookmark_tweet_id}")
    print(f"Follow user ID: {follow_user_id}")
    print(f"Instance ID: {instance_id}")
    confirm_or_exit("\n⚠️  This will reverse 4 actions on your X account!", assume_yes)

    client = ClawBotClient()
    results = []

    # Test 1: Unlike
    print("\n" + "-"*60)
    print("📍 Testing unlike...")
    result = client.x.actions.unlike(like_tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unlike successful")
        results.append(("Unlike", True))
    else:
        print("❌ Unlike failed")
        results.append(("Unlike", False))

    import time
    time.sleep(2)

    # Test 2: Unretweet
    print("\n" + "-"*60)
    print("📍 Testing unretweet...")
    result = client.x.actions.unretweet(retweet_tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unretweet successful")
        results.append(("Unretweet", True))
    else:
        print("❌ Unretweet failed")
        results.append(("Unretweet", False))

    time.sleep(2)

    # Test 3: Unbookmark
    print("\n" + "-"*60)
    print("📍 Testing unbookmark...")
    result = client.x.actions.unbookmark(bookmark_tweet_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unbookmark successful")
        results.append(("Unbookmark", True))
    else:
        print("❌ Unbookmark failed")
        results.append(("Unbookmark", False))

    time.sleep(2)

    # Test 4: Unfollow
    print("\n" + "-"*60)
    print("📍 Testing unfollow...")
    result = client.x.actions.unfollow(follow_user_id, instance_id=instance_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unfollow successful")
        results.append(("Unfollow", True))
    else:
        print("❌ Unfollow failed")
        results.append(("Unfollow", False))

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test reverse actions on X')
    parser.add_argument('--instance-id', type=str, help='Explicit instanceId for multi-instance routing')
    parser.add_argument('--yes', action='store_true', help='Skip interactive confirmation')
    args = parser.parse_args()

    print("\n🧪 Testing Reverse Actions (Scenario 8)")
    print("="*60)
    print("⚠️  WARNING: These tests reverse actions on your X account!")
    print("="*60)

    bootstrap_client = ClawBotClient()
    instance_id = resolve_instance_id(bootstrap_client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")

    results = test_reverse_actions(instance_id=instance_id, assume_yes=args.yes)

    if results:
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
    else:
        print("\n⏭️  Tests skipped")
        sys.exit(0)
