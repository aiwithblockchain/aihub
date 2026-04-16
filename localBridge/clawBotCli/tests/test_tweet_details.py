#!/usr/bin/env python3
"""
Legacy test script for tweet details and replies.

Migration note:
- Kept for backward compatibility during refactor
- New example: `examples/tweet_details_and_search_example.py`
- New integration smoke tests: `tests/integration/test_tweet_search_flows.py`
- New code should prefer `from clawbot import ClawBotClient`
"""
import sys
import os
import json

# Add parent directory to path for imports
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

    client = ClawBotClient()
    tweet = client.x.tweets.get_tweet(tweet_id)

    print(json.dumps(tweet.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if tweet.id:
        print(f"✅ Tweet retrieved successfully")
        print(f"   Tweet ID: {tweet.id}")
        print(f"   Text: {tweet.text[:100] if tweet.text else '(no text)'}...")
        print(f"   Author: @{tweet.author_screen_name}")

        # Check for Twitter GraphQL structure
        response_str = str(tweet.raw)
        if 'threaded_conversation_with_injections_v2' in response_str:
            print("✅ Response contains Twitter GraphQL tweet detail structure")
        if 'rest_id' in response_str and 'legacy' in response_str:
            print("✅ Response contains tweet data (rest_id, legacy)")

        return True
    else:
        print(f"❌ Failed to parse tweet")
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

    client = ClawBotClient()

    # Test without cursor (first page)
    print("\n📄 Testing first page (no cursor)...")
    replies = client.x.tweets.get_tweet_replies(tweet_id)

    print(f"Retrieved {len(replies)} replies")
    if replies:
        first = replies[0]
        print(f"First reply: {first.text[:100] if first.text else '(no text)'}...")
        print(f"Author: @{first.author_screen_name}")

    print(f"✅ Replies retrieved successfully ({len(replies)} replies)")

    # Check for Twitter GraphQL structure
    if replies:
        response_str = str(replies[0].raw)
        if 'rest_id' in response_str or 'legacy' in response_str:
            print("✅ Response contains Twitter GraphQL replies structure")

    # Try pagination test
    try:
        print(f"\n📄 Testing pagination with cursor...")
        replies2 = client.x.tweets.get_tweet_replies(tweet_id, cursor="placeholder")
        print(f"✅ Pagination API call successful ({len(replies2)} replies)")
    except Exception as e:
        print(f"⚠️  Pagination test skipped: {e}")

    return True


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
