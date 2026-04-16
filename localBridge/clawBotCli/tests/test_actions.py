#!/usr/bin/env python3
"""
Test Positive Actions (Like, Retweet, Bookmark, Follow)
测试场景 7: 点赞、转发、收藏和关注测试
"""
import sys
import json
import os
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def get_tweet_and_user_by_id(tweet_id):
    """Get tweet details and extract user ID from specified tweet"""
    print(f"\n📋 Fetching tweet details for ID: {tweet_id}...")
    client = ClawBotClient()
    tweet = client.x.tweets.get_tweet(tweet_id)

    if tweet and tweet.author_id:
        user_id = tweet.author_id
        print(f"✅ Found user ID: {user_id}")
        return tweet_id, user_id
    else:
        print(f"⚠️  Failed to extract user ID")
        return tweet_id, None


def extract_tweet_and_user_from_timeline():
    """Extract a tweet ID and user ID from timeline for testing"""
    print("\n📋 Extracting tweet ID and user ID from timeline...")
    client = ClawBotClient()
    tweet = client.x.timeline.get_first_timeline_tweet()

    if tweet and tweet.id and tweet.author_id:
        print(f"✅ Found tweet ID: {tweet.id}")
        print(f"✅ Found user ID: {tweet.author_id}")
        return tweet.id, tweet.author_id
    else:
        print(f"⚠️  Failed to extract IDs")
        return None, None


def test_positive_actions(tweet_id=None):
    """Test all positive actions: Like, Retweet, Bookmark, Follow"""
    print("\n" + "="*60)
    print("Testing: Positive Actions (Like, Retweet, Bookmark, Follow)")
    print("="*60)

    if tweet_id:
        tweet_id, user_id = get_tweet_and_user_by_id(tweet_id)
    else:
        tweet_id, user_id = extract_tweet_and_user_from_timeline()

    if not tweet_id or not user_id:
        print("❌ Failed to extract tweet ID or user ID")
        return False

    print(f"\nUsing tweet ID: {tweet_id}")
    print(f"Using user ID: {user_id}")
    print("\n⚠️  This will perform 4 real actions on your X account!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return False

    client = ClawBotClient()
    actions_data = {}
    results = []

    # Test 1: Like
    print("\n" + "-"*60)
    print("📍 Testing like...")
    result = client.x.actions.like(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Like successful")
        actions_data['like_tweet_id'] = tweet_id
        results.append(("Like", True))
    else:
        print("❌ Like failed")
        results.append(("Like", False))

    import time
    time.sleep(2)

    # Test 2: Retweet
    print("\n" + "-"*60)
    print("📍 Testing retweet...")
    result = client.x.actions.retweet(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Retweet successful")
        actions_data['retweet_tweet_id'] = tweet_id
        results.append(("Retweet", True))
    else:
        print("❌ Retweet failed")
        results.append(("Retweet", False))

    time.sleep(2)

    # Test 3: Bookmark
    print("\n" + "-"*60)
    print("📍 Testing bookmark...")
    result = client.x.actions.bookmark(tweet_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Bookmark successful")
        actions_data['bookmark_tweet_id'] = tweet_id
        results.append(("Bookmark", True))
    else:
        print("❌ Bookmark failed")
        results.append(("Bookmark", False))

    time.sleep(2)

    # Test 4: Follow
    print("\n" + "-"*60)
    print("📍 Testing follow...")
    result = client.x.actions.follow(user_id)
    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Follow successful")
        actions_data['follow_user_id'] = user_id
        results.append(("Follow", True))
    else:
        print("❌ Follow failed")
        results.append(("Follow", False))

    # Save actions data to JSON file
    if actions_data:
        json_path = os.path.join(os.path.dirname(__file__), '..', 'test_actions.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(actions_data, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Actions data saved to: {json_path}")
        print(f"   Data: {json.dumps(actions_data, ensure_ascii=False)}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test positive actions on X')
    parser.add_argument('--tweet-id', type=str, help='Specify tweet ID to test (optional)')
    args = parser.parse_args()

    print("\n🧪 Testing Positive Actions (Scenario 7)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    results = test_positive_actions(tweet_id=args.tweet_id)

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
