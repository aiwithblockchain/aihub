#!/usr/bin/env python3
"""
Test Write APIs (Create Tweet, Reply, Like, Retweet, Follow, etc.)
WARNING: These tests will perform actual actions on your X account!
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_create_tweet():
    """Test POST /api/v1/x/tweets"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/x/tweets")
    print("="*60)
    print("⚠️  This will post a real tweet to your account!")

    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    text = input("Enter tweet text (default: Test from ClawBot CLI): ").strip()
    if not text:
        text = "Test from ClawBot CLI"

    client = ClawBotClient()
    result = client.x.actions.create_tweet(text)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if result.success:
        print("✅ Tweet created successfully")
        return True
    else:
        print("❌ Failed to create tweet")
        return False


def test_like_tweet():
    """Test POST /api/v1/x/likes"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/x/likes")
    print("="*60)

    tweet_id = input("Enter tweet ID to like (or press Enter to skip): ").strip()
    if not tweet_id:
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()
    result = client.x.actions.like(tweet_id)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if result.success:
        print("✅ Tweet liked successfully")
        return True
    else:
        print("❌ Failed to like tweet")
        return False


def test_retweet():
    """Test POST /api/v1/x/retweets"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/x/retweets")
    print("="*60)

    tweet_id = input("Enter tweet ID to retweet (or press Enter to skip): ").strip()
    if not tweet_id:
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()
    result = client.x.actions.retweet(tweet_id)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if result.success:
        print("✅ Retweeted successfully")
        return True
    else:
        print("❌ Failed to retweet")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Write APIs")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    results = []
    results.append(("Create Tweet", test_create_tweet()))
    results.append(("Like Tweet", test_like_tweet()))
    results.append(("Retweet", test_retweet()))

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
