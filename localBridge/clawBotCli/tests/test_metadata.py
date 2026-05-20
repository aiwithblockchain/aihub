#!/usr/bin/env python3
"""
Legacy test script for metadata queries.

Migration note:
- Kept for backward compatibility during refactor
- New example: `examples/status_and_metadata_example.py`
- New integration smoke tests: `tests/integration/test_status_metadata_flows.py`
- New code should prefer `from clawbot import ClawBotClient`
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_api_docs():
    """Test GET /api/v1/x/docs"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/docs")
    print("="*60)

    client = ClawBotClient()
    response = client.x_transport.request_json('GET', '/api/v1/x/docs')

    print(json.dumps(response, indent=2, ensure_ascii=False)[:800] + "...")

    # Validate response
    if isinstance(response, list) and len(response) > 0:
        print(f"✅ API Docs returned {len(response)} API definitions")
        # Check if it contains expected APIs
        api_ids = [api.get('id') for api in response if isinstance(api, dict)]
        expected_apis = ['query_x_status', 'query_x_basic_info', 'create_tweet']
        found = [api_id for api_id in expected_apis if api_id in api_ids]
        print(f"✅ Found expected APIs: {', '.join(found)}")
        return True
    else:
        print("❌ Invalid API docs response")
        return False


def test_x_status():
    """Test GET /api/v1/x/status"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/status")
    print("="*60)

    client = ClawBotClient()
    status = client.x.status.get_status()

    print(json.dumps({'hasXTabs': status.has_x_tabs, 'isLoggedIn': status.is_logged_in, 'tabs': len(status.tabs)}, indent=2, ensure_ascii=False))

    print(f"✅ Status query successful")
    print(f"   - hasXTabs: {status.has_x_tabs}")
    print(f"   - isLoggedIn: {status.is_logged_in}")
    print(f"   - tabs count: {len(status.tabs)}")
    return True


def test_instances():
    """Test GET /api/v1/x/instances"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/instances")
    print("="*60)

    client = ClawBotClient()
    response = client.x_transport.request_json('GET', '/api/v1/x/instances')

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    # Validate response
    if isinstance(response, list):
        print(f"✅ Instances query successful")
        print(f"   - Connected instances: {len(response)}")
        for idx, instance in enumerate(response):
            if isinstance(instance, dict):
                print(f"   - Instance {idx+1}: {instance.get('instanceName', 'N/A')} ({instance.get('clientName', 'N/A')})")
        return True
    else:
        print("❌ Invalid instances response")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Metadata APIs (Scenario 1)")
    print("="*60)

    results = []
    results.append(("API Docs", test_api_docs()))
    results.append(("X Status", test_x_status()))
    results.append(("Instances", test_instances()))

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
