#!/usr/bin/env python3
"""
Test Like and Retweet APIs (Like, Unlike, Retweet, Unretweet)
测试场景 6: 点赞和转发测试
"""
import sys
import json
from utils.api_client import APIClient


def extract_tweet_id_from_timeline():
    """Extract a tweet ID from timeline for testing"""
    print("\n📋 Extracting tweet ID from timeline...")
    client = APIClient()
    response = client.get_timeline()

    try:
        if 'data' in response and 'home' in response['data']:
            instructions = response['data']['home']['home_timeline_urt']['instructions']
            for instruction in instructions:
                if instruction.get('type') == 'TimelineAddEntries':
                    entries = instruction.get('entries', [])
                    for entry in entries:
                        if 'tweet-' in entry.get('entryId', ''):
                            content = entry.get('content', {})
                            tweet_results = content.get('itemContent', {}).get('tweet_results', {})
                            result = tweet_results.get('result', {})
                            tweet_id = result.get('rest_id')
                            if tweet_id:
                                print(f"✅ Found tweet ID: {tweet_id}")
                                return tweet_id
    except Exception as e:
        print(f"⚠️  Failed to extract tweet ID: {e}")

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

    client = APIClient()

    # Test like
    print("\n📍 Testing like...")
    response = client.like_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'favorite_tweet' in str(response):
        print("✅ Like successful")
    else:
        print("❌ Like failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unlike
    print("\n📍 Testing unlike...")
    response = client.unlike_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'unfavorite_tweet' in str(response):
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

    client = APIClient()

    # Test retweet
    print("\n📍 Testing retweet...")
    response = client.retweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'create_retweet' in str(response):
        print("✅ Retweet successful")
    else:
        print("❌ Retweet failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unretweet
    print("\n📍 Testing unretweet...")
    response = client.unretweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'unretweet' in str(response):
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
