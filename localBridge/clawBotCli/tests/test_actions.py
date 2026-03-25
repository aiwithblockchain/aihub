#!/usr/bin/env python3
"""
Test Positive Actions (Like, Retweet, Bookmark, Follow)
测试场景 7: 点赞、转发、收藏和关注测试
"""
import sys
import json
import os
from utils.api_client import APIClient


def extract_tweet_and_user_from_timeline():
    """Extract a tweet ID and user ID from timeline for testing"""
    print("\n📋 Extracting tweet ID and user ID from timeline...")
    client = APIClient()
    response = client.get_timeline()

    tweet_id = None
    user_id = None

    try:
        if 'data' in response:
            data = response['data']
            if 'data' in data and 'home' in data['data']:
                instructions = data['data']['home']['home_timeline_urt']['instructions']
            elif 'home' in data:
                instructions = data['home']['home_timeline_urt']['instructions']
            else:
                return None, None

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


def test_positive_actions():
    """Test all positive actions: Like, Retweet, Bookmark, Follow"""
    print("\n" + "="*60)
    print("Testing: Positive Actions (Like, Retweet, Bookmark, Follow)")
    print("="*60)

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

    client = APIClient()
    actions_data = {}
    results = []

    # Test 1: Like
    print("\n" + "-"*60)
    print("📍 Testing like...")
    response = client.like_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'favorite_tweet' in str(response):
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
    response = client.retweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'create_retweet' in str(response):
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
    response = client.bookmark_tweet(tweet_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'create_bookmark' in str(response):
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
    response = client.follow_user(user_id)
    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'following' in str(response):
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
    print("\n🧪 Testing Positive Actions (Scenario 7)")
    print("="*60)
    print("⚠️  WARNING: These tests perform real actions on your X account!")
    print("="*60)

    results = test_positive_actions()

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
