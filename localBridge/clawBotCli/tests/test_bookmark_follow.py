#!/usr/bin/env python3
"""
Test Bookmark and Follow APIs (Bookmark, Unbookmark, Follow, Unfollow)
测试场景 7: 收藏和关注测试
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def extract_tweet_and_user_from_timeline():
    """Extract a tweet ID and user ID from timeline for testing"""
    print("\n📋 Extracting tweet ID and user ID from timeline...")
    client = ClawBotClient()

    tweet = client.x.timeline.get_first_timeline_tweet()
    if not tweet:
        print(f"⚠️  No tweets found in timeline")
        return None, None

    tweet_id = tweet.id
    user_id = tweet.author_id

    if tweet_id and user_id:
        print(f"✅ Found tweet ID: {tweet_id}")
        print(f"✅ Found user ID: {user_id}")

    return tweet_id, user_id


def test_bookmark_unbookmark():
    """Test POST /api/v1/x/bookmarks and /api/v1/x/unbookmarks"""
    print("\n" + "="*60)
    print("Testing: Bookmark and Unbookmark Tweet")
    print("="*60)

    tweet_id, _ = extract_tweet_and_user_from_timeline()
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print("⚠️  This will bookmark and then unbookmark a real tweet!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()

    # Test bookmark
    print("\n📍 Testing bookmark...")
    result = client.x.actions.bookmark(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Bookmark successful")
    else:
        print("❌ Bookmark failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unbookmark
    print("\n📍 Testing unbookmark...")
    result = client.x.actions.unbookmark(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unbookmark successful")
        return True
    else:
        print("❌ Unbookmark failed")
        return False


def test_follow_unfollow():
    """Test POST /api/v1/x/follows and /api/v1/x/unfollows"""
    print("\n" + "="*60)
    print("Testing: Follow and Unfollow User")
    print("="*60)

    _, user_id = extract_tweet_and_user_from_timeline()
    if not user_id:
        print("⏭️  Skipped - No user ID available")
        return True

    print(f"Using user ID: {user_id}")
    print("⚠️  This will follow and then unfollow a real user!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()

    # Test follow
    print("\n📍 Testing follow...")
    result = client.x.actions.follow(user_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Follow successful")
    else:
        print("❌ Follow failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unfollow
    print("\n📍 Testing unfollow...")
    result = client.x.actions.unfollow(user_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unfollow successful")
        return True
    else:
        print("❌ Unfollow failed")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Bookmark and Follow APIs (Scenario 7)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    results = []
    results.append(("Bookmark/Unbookmark", test_bookmark_unbookmark()))
    results.append(("Follow/Unfollow", test_follow_unfollow()))

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
