#!/usr/bin/env python3
"""
Test Status Query APIs
"""
import sys
import json
from utils.api_client import APIClient
from utils.response_parser import validate_response, print_response_summary


def test_x_status():
    """Test GET /api/v1/x/status"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/status")
    print("="*60)

    client = APIClient()
    response = client.get_x_status()

    print(json.dumps(response, indent=2, ensure_ascii=False))

    # Validate
    if 'hasXTabs' in response and 'isLoggedIn' in response:
        print("✅ Status API working correctly")
        return True
    else:
        print("❌ Unexpected response format")
        return False


def test_instances():
    """Test GET /api/v1/x/instances"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/instances")
    print("="*60)

    client = APIClient()
    response = client.get_instances()

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if isinstance(response, list):
        print(f"✅ Found {len(response)} connected instance(s)")
        return True
    else:
        print("❌ Expected array response")
        return False


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
        return True
    else:
        print(f"❌ {message}")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Status Query APIs")
    print("="*60)

    results = []
    results.append(("X Status", test_x_status()))
    results.append(("Instances", test_instances()))
    results.append(("Basic Info", test_basic_info()))

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
