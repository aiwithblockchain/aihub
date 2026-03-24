#!/usr/bin/env python3
"""
Test Read APIs (Timeline, Tweet, User Profile, Search)
"""
import sys
import json
from utils.api_client import APIClient
from utils.response_parser import validate_response, print_response_summary


def test_timeline():
    """Test GET /api/v1/x/timeline"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/timeline")
    print("="*60)

    client = APIClient()
    response = client.get_timeline()

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)
        return True
    else:
        print(f"❌ {message}")
        return False


def test_get_tweet():
    """Test GET /api/v1/x/tweets/{tweetId}"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/tweets/{tweetId}")
    print("="*60)

    # 需要用户提供真实的 tweet ID
    tweet_id = input("Enter a tweet ID to test (or press Enter to skip): ").strip()
    if not tweet_id:
        print("⏭️  Skipped")
        return True

    client = APIClient()
    response = client.get_tweet(tweet_id)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)
        return True
    else:
        print(f"❌ {message}")
        return False


def test_user_profile():
    """Test GET /api/v1/x/users"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/users")
    print("="*60)

    screen_name = input("Enter a screen name to test (default: elonmusk): ").strip()
    if not screen_name:
        screen_name = "elonmusk"

    client = APIClient()
    response = client.get_user_profile(screen_name)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)
        return True
    else:
        print(f"❌ {message}")
        return False


def test_search():
    """Test GET /api/v1/x/search"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/search")
    print("="*60)

    query = input("Enter search query (default: AI): ").strip()
    if not query:
        query = "AI"

    client = APIClient()
    response = client.search_timeline(query, count=5)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)
        return True
    else:
        print(f"❌ {message}")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Read APIs")
    print("="*60)

    results = []
    results.append(("Timeline", test_timeline()))
    results.append(("Get Tweet", test_get_tweet()))
    results.append(("User Profile", test_user_profile()))
    results.append(("Search", test_search()))

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
