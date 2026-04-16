#!/usr/bin/env python3
"""
Legacy test script for status queries.

Migration note:
- Kept for backward compatibility during refactor
- New example: `examples/status_and_metadata_example.py`
- New integration smoke tests: `tests/integration/test_status_metadata_flows.py`
- New code should prefer `from clawbot import ClawBotClient`
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def test_x_status():
    """Test GET /api/v1/x/status"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/status")
    print("="*60)

    client = ClawBotClient()
    status = client.x.status.get_status()

    print(json.dumps(status.raw, indent=2, ensure_ascii=False))

    # Validate
    if status.has_x_tabs is not None and status.is_logged_in is not None:
        print("✅ Status API working correctly")
        print(f"   hasXTabs: {status.has_x_tabs}")
        print(f"   isLoggedIn: {status.is_logged_in}")
        print(f"   tabs: {len(status.tabs)}")
        return True
    else:
        print("❌ Unexpected response format")
        return False


def test_instances():
    """Test GET /api/v1/x/instances"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/instances")
    print("="*60)

    client = ClawBotClient()
    response = client.x.status.get_instances()

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

    client = ClawBotClient()
    user = client.x.status.get_basic_info()

    print(json.dumps(user.raw, indent=2, ensure_ascii=False)[:500] + "...")

    if user.id and user.screen_name:
        print(f"✅ Basic info retrieved successfully")
        print(f"   User ID: {user.id}")
        print(f"   Screen name: @{user.screen_name}")
        print(f"   Name: {user.name}")
        return True
    else:
        print(f"❌ Failed to parse user info")
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
