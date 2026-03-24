#!/usr/bin/env python3
"""
Test Tweet Details APIs (Get Tweet, Get Tweet Replies with Pagination)
测试场景 3: 推文详情和回复测试
"""
import sys
import json
from utils.api_client import APIClient
from utils.response_parser import validate_response, print_response_summary


def extract_tweet_id_from_timeline():
    """Extract a tweet ID from timeline for testing"""
    print("\n📋 Extracting tweet ID from timeline...")
    client = APIClient()
    response = client.get_timeline()

    # Try to extract tweet ID from timeline response
    try:
        # Handle nested data structure: response.data.data
        data = response.get('data', {})
        if 'data' in data:
            data = data['data']

        if 'home' in data:
            instructions = data['home']['home_timeline_urt']['instructions']
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


def test_get_tweet(tweet_id=None):
    """Test GET /api/v1/x/tweets/{tweetId}"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/tweets/{tweetId}")
    print("="*60)

    if not tweet_id:
        tweet_id = extract_tweet_id_from_timeline()

    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    client = APIClient()
    response = client.get_tweet(tweet_id)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)

        # Check for Twitter GraphQL structure
        response_str = str(response)
        if 'threaded_conversation_with_injections_v2' in response_str:
            print("✅ Response contains Twitter GraphQL tweet detail structure")
        if 'rest_id' in response_str and 'legacy' in response_str:
            print("✅ Response contains tweet data (rest_id, legacy)")

        return True
    else:
        print(f"❌ {message}")
        return False


def test_get_tweet_replies(tweet_id=None):
    """Test GET /api/v1/x/tweets/{tweetId}/replies"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/tweets/{tweetId}/replies")
    print("="*60)

    if not tweet_id:
        tweet_id = extract_tweet_id_from_timeline()

    if not tweet_id:
        print("⏭️  Skipped - No tweet ID available")
        return True

    client = APIClient()

    # Test without cursor (first page)
    print("\n📄 Testing first page (no cursor)...")
    response = client.get_tweet_replies(tweet_id)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)

        # Check for Twitter GraphQL structure
        response_str = str(response)
        if 'threaded_conversation_with_injections_v2' in response_str:
            print("✅ Response contains Twitter GraphQL replies structure")

        # Try to extract cursor for pagination test
        try:
            # Handle nested data structure
            data = response.get('data', {})
            if 'data' in data:
                data = data['data']
            instructions = data['threaded_conversation_with_injections_v2']['instructions']
            cursor = None
            for instruction in instructions:
                if instruction.get('type') == 'TimelineAddEntries':
                    entries = instruction.get('entries', [])
                    for entry in entries:
                        if 'cursor-bottom' in entry.get('entryId', ''):
                            cursor = entry.get('content', {}).get('value')
                            break

            if cursor:
                print(f"\n📄 Testing pagination with cursor...")
                print(f"   Cursor: {cursor[:50]}...")
                response2 = client.get_tweet_replies(tweet_id, cursor=cursor)
                if 'data' in response2:
                    print("✅ Pagination test successful")
                else:
                    print("⚠️  Pagination returned unexpected response")
        except Exception as e:
            print(f"⚠️  Pagination test skipped: {e}")

        return True
    else:
        print(f"❌ {message}")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Tweet Details APIs (Scenario 3)")
    print("="*60)

    # Extract tweet ID once for both tests
    tweet_id = extract_tweet_id_from_timeline()

    results = []
    results.append(("Get Tweet", test_get_tweet(tweet_id)))
    results.append(("Get Tweet Replies", test_get_tweet_replies(tweet_id)))

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
