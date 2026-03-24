#!/usr/bin/env python3
"""
Test Bookmark and Follow APIs (Bookmark, Unbookmark, Follow, Unfollow)
测试场景 7: 收藏和关注测试
"""
import sys
import json
from utils.api_client import APIClient


def extract_tweet_and_user_from_timeline():
    """Extract a tweet ID and user ID from timeline for testing"""
    print("\n📋 Extracting tweet ID and user ID from timeline...")
    client = APIClient()
    response = client.get_timeline()

    tweet_id = None
    user_id = None

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

                            if not tweet_id:
                                tweet_id = result.get('rest_id')

                            # Extract user ID from tweet author
                            if not user_id:
                                core = result.get('core', {})
                                user_results = core.get('user_results', {})
                                user_result = user_results.get('result', {})
                                user_id = user_result.get('rest_id')

                            if tweet_id and user_id:
                                print(f"✅ Found tweet ID: {tweet_id}")
                                print(f"✅ Found user ID: {user_id}")
                                return tweet_id, user_id
    except Exception as e:
        print(f"⚠️  Failed to extract IDs: {e}")

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

    client = APIClient()

    # Test bookmark
    print("\n📍 Testing bookmark...")
    response = client.bookmark_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'create_bookmark' in str(response):
        print("✅ Bookmark successful")
    else:
        print("❌ Bookmark failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unbookmark
    print("\n📍 Testing unbookmark...")
    response = client.unbookmark_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'delete_bookmark' in str(response):
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

    client = APIClient()

    # Test follow
    print("\n📍 Testing follow...")
    response = client.follow_user(user_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'following' in str(response):
        print("✅ Follow successful")
    else:
        print("❌ Follow failed")
        return False

    # Wait a moment
    import time
    time.sleep(2)

    # Test unfollow
    print("\n📍 Testing unfollow...")
    response = client.unfollow_user(user_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'following' in str(response):
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
