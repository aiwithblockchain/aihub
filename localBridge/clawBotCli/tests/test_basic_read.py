#!/usr/bin/env python3
"""
Test Basic Read APIs (Basic Info, Timeline)
测试场景 2: 基础读取测试
"""
import sys
import json
from utils.api_client import APIClient
from utils.response_parser import validate_response, print_response_summary


def test_basic_info():
    """Test GET /api/v1/x/basic_info"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/basic_info")
    print("="*60)

    client = APIClient()
    response = client.get_basic_info()

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    is_valid, message = validate_response(response)
    if is_valid:
        print(f"✅ {message}")
        print_response_summary(response)

        # Check for Twitter GraphQL structure
        if '__typename' in str(response) and 'rest_id' in str(response):
            print("✅ Response contains Twitter GraphQL structure (__typename, rest_id)")
        if 'legacy' in str(response) and 'screen_name' in str(response):
            print("✅ Response contains legacy.screen_name field")

        return True
    else:
        print(f"❌ {message}")
        return False


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

        # Check for Twitter GraphQL structure
        response_str = str(response)
        if 'home_timeline_urt' in response_str and 'instructions' in response_str:
            print("✅ Response contains Twitter GraphQL timeline structure")
        if 'TimelineAddEntries' in response_str:
            print("✅ Response contains TimelineAddEntries instruction")

        return True
    else:
        print(f"❌ {message}")
        return False


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
