#!/usr/bin/env python3
"""
Test User and Search APIs (User Profile, Search Timeline)
测试场景 4: 用户和搜索测试
"""
import sys
import json
from utils.api_client import APIClient
from utils.response_parser import validate_response, print_response_summary


def test_user_profile():
    """Test GET /api/v1/x/users"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/users")
    print("="*60)

    # Use a well-known account for testing
    screen_name = "elonmusk"
    print(f"Testing with screen_name: {screen_name}")

    client = APIClient()
    response = client.get_user_profile(screen_name)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)

        # Check for Twitter GraphQL structure
        response_str = str(response)
        if 'rest_id' in response_str and 'legacy' in response_str:
            print("✅ Response contains Twitter GraphQL user structure")
        if 'screen_name' in response_str:
            print("✅ Response contains screen_name field")

        return True
    else:
        print(f"❌ {message}")
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

    client = APIClient()
    response = client.search_timeline(query, count=count)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)

        # Check for Twitter GraphQL structure
        response_str = str(response)
        if 'search_by_raw_query' in response_str or 'search_timeline' in response_str:
            print("✅ Response contains Twitter GraphQL search structure")
        if 'instructions' in response_str:
            print("✅ Response contains instructions array")

        # Try pagination test
        try:
            if 'data' in response:
                search_data = response['data'].get('search_by_raw_query', {}).get('search_timeline', {})
                timeline = search_data.get('timeline', {})
                metadata = timeline.get('metadata', {})
                cursor = metadata.get('cursor')

                if cursor:
                    print(f"\n📄 Testing pagination with cursor...")
                    print(f"   Cursor: {cursor[:50]}...")
                    response2 = client.search_timeline(query, cursor=cursor, count=count)
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
