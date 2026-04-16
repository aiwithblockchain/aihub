#!/usr/bin/env python3
"""
Test Reverse Actions (Unlike, Unretweet, Unbookmark, Unfollow)
测试场景 8: 取消点赞、取消转发、取消收藏和取消关注测试
"""
import sys
import json
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


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


def test_reverse_actions():
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
    print("\n⚠️  This will reverse 4 actions on your X account!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return False

    client = ClawBotClient()
    results = []

    # Test 1: Unlike
    print("\n" + "-"*60)
    print("📍 Testing unlike...")
    result = client.x.actions.unlike(like_tweet_id)
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
    result = client.x.actions.unretweet(retweet_tweet_id)
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
    result = client.x.actions.unbookmark(bookmark_tweet_id)
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
    result = client.x.actions.unfollow(follow_user_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unfollow successful")
        results.append(("Unfollow", True))
    else:
        print("❌ Unfollow failed")
        results.append(("Unfollow", False))

    return results


if __name__ == "__main__":
    print("\n🧪 Testing Reverse Actions (Scenario 8)")
    print("="*60)
    print("⚠️  WARNING: These tests reverse actions on your X account!")
    print("="*60)

    results = test_reverse_actions()

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
