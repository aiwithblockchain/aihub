#!/usr/bin/env python3
"""
Legacy test script for basic read flows.

Migration note:
- Kept for backward compatibility during refactor
- New example: `examples/read_api_examples.py`
- New integration smoke tests: `tests/integration/test_read_flows.py`
- New code should prefer `from clawbot import ClawBotClient`
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def test_basic_info():
    """Test GET /api/v1/x/basic_info"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/basic_info")
    print("="*60)

    client = ClawBotClient()
    user = client.x.status.get_basic_info()

    print(json.dumps(user.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if user.id and user.screen_name:
        print(f"✅ Basic info retrieved successfully")
        print(f"   User ID: {user.id}")
        print(f"   Screen name: @{user.screen_name}")
        print(f"   Name: {user.name}")

        # Check for Twitter GraphQL structure
        response_str = str(user.raw)
        if '__typename' in response_str and 'rest_id' in response_str:
            print("✅ Response contains Twitter GraphQL structure (__typename, rest_id)")
        if 'legacy' in response_str and 'screen_name' in response_str:
            print("✅ Response contains legacy.screen_name field")

        return True
    else:
        print(f"❌ Failed to parse user info")
        return False


def test_timeline():
    """Test GET /api/v1/x/timeline"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/timeline")
    print("="*60)

    client = ClawBotClient()
    tweets = client.x.timeline.list_timeline_tweets()

    print(f"Retrieved {len(tweets)} tweets from timeline")
    if tweets:
        first = tweets[0]
        print(f"First tweet: {first.text[:100] if first.text else '(no text)'}...")
        print(f"Author: @{first.author_screen_name}")

    if tweets:
        print(f"✅ Timeline retrieved successfully ({len(tweets)} tweets)")

        # Check for Twitter GraphQL structure in raw response
        response_str = str(tweets[0].raw)
        if 'rest_id' in response_str or 'legacy' in response_str:
            print("✅ Response contains Twitter GraphQL timeline structure")

        return True
    else:
        print(f"⚠️  Timeline returned no tweets (may be empty)")
        return True


if __name__ == "__main__":
    print("\n🧪 Testing Basic Read APIs (Scenario 2)")
    print("="*60)

    results = []
    results.append(("Basic Info", test_basic_info()))
    results.append(("Timeline", test_timeline()))

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
