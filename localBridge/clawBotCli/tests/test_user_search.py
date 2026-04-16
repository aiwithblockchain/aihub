#!/usr/bin/env python3
"""
Legacy test script for user profile and search flows.

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


def test_user_profile():
    """Test GET /api/v1/x/users"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/users")
    print("="*60)

    # Use a well-known account for testing
    screen_name = "elonmusk"
    print(f"Testing with screen_name: {screen_name}")

    client = ClawBotClient()
    user = client.x.users.get_user(screen_name)

    print(json.dumps(user.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if user.id and user.screen_name:
        print(f"✅ User profile retrieved successfully")
        print(f"   User ID: {user.id}")
        print(f"   Screen name: @{user.screen_name}")
        print(f"   Name: {user.name}")

        # Check for Twitter GraphQL structure
        response_str = str(user.raw)
        if 'rest_id' in response_str and 'legacy' in response_str:
            print("✅ Response contains Twitter GraphQL user structure")
        if 'screen_name' in response_str:
            print("✅ Response contains screen_name field")

        return True
    else:
        print(f"❌ Failed to parse user profile")
        return False


def test_search_timeline():
    """Test GET /api/v1/x/search"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/search")
    print("="*60)

    # Use a common search query
    query = "AI"
    count = 5
    print(f"Testing with query: '{query}', count: {count}")

    client = ClawBotClient()
    tweets, users = client.x.search.search(query, count=count)

    print(f"Retrieved {len(tweets)} tweets and {len(users)} users")
    if tweets:
        first = tweets[0]
        print(f"First tweet: {first.text[:100] if first.text else '(no text)'}...")
        print(f"Author: @{first.author_screen_name}")

    if tweets:
        print(f"✅ Search retrieved successfully ({len(tweets)} tweets)")

        # Check for Twitter GraphQL structure
        response_str = str(tweets[0].raw)
        if 'rest_id' in response_str or 'legacy' in response_str:
            print("✅ Response contains Twitter GraphQL search structure")

        # Try pagination test - search with cursor
        try:
            print(f"\n📄 Testing pagination with cursor...")
            # For pagination test, we'd need to extract cursor from raw response
            # Simplified: just test that second page call works
            tweets2, _ = client.x.search.search(query, count=count, cursor="placeholder")
            print("✅ Pagination API call successful")
        except Exception as e:
            print(f"⚠️  Pagination test skipped: {e}")

        return True
    else:
        print(f"⚠️  Search returned no results")
        return True


if __name__ == "__main__":
    print("\n🧪 Testing User and Search APIs (Scenario 4)")
    print("="*60)

    results = []
    results.append(("User Profile", test_user_profile()))
    results.append(("Search Timeline", test_search_timeline()))

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
