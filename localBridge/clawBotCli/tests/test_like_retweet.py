#!/usr/bin/env python3
"""
Test Like and Retweet APIs (Like, Unlike, Retweet, Unretweet)
测试场景 6: 点赞和转发测试
"""
import sys
import os
import json
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def extract_tweet_id_from_timeline():
    """Extract a tweet ID from timeline for testing"""
    print("\n📋 Extracting tweet ID from timeline...")
    client = ClawBotClient()
    tweet = client.x.timeline.get_first_timeline_tweet()

    if tweet and tweet.id:
        print(f"✅ Found tweet ID: {tweet.id}")
        return tweet.id

    print(f"⚠️  No tweets found in timeline")
    return None


def test_like_unlike():
    """Test POST /api/v1/x/likes and /api/v1/x/unlikes"""
    print("\n" + "="*60)
    print("Testing: Like and Unlike Tweet")
    print("="*60)

    tweet_id = extract_tweet_id_from_timeline()
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print("⚠️  This will like and then unlike a real tweet!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()

    # Test like
    print("\n📍 Testing like...")
    result = client.x.actions.like(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Like successful")
    else:
        print("❌ Like failed")
        return False

    # Wait a moment
    time.sleep(2)

    # Test unlike
    print("\n📍 Testing unlike...")
    result = client.x.actions.unlike(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unlike successful")
        return True
    else:
        print("❌ Unlike failed")
        return False


def test_retweet_unretweet():
    """Test POST /api/v1/x/retweets and /api/v1/x/unretweets"""
    print("\n" + "="*60)
    print("Testing: Retweet and Unretweet")
    print("="*60)

    tweet_id = extract_tweet_id_from_timeline()
    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    print(f"Using tweet ID: {tweet_id}")
    print("⚠️  This will retweet and then unretweet a real tweet!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()

    # Test retweet
    print("\n📍 Testing retweet...")
    result = client.x.actions.retweet(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Retweet successful")
    else:
        print("❌ Retweet failed")
        return False

    # Wait a moment
    time.sleep(2)

    # Test unretweet
    print("\n📍 Testing unretweet...")
    result = client.x.actions.unretweet(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Unretweet successful")
        return True
    else:
        print("❌ Unretweet failed")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Like and Retweet APIs (Scenario 6)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    results = []
    results.append(("Like/Unlike", test_like_unlike()))
    results.append(("Retweet/Unretweet", test_retweet_unretweet()))

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
