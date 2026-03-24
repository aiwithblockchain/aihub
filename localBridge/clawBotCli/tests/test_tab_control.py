#!/usr/bin/env python3
"""
Test Tab Control APIs (Open, Close, Navigate)
"""
import sys
import json
import time
from utils.api_client import APIClient


def test_open_tab():
    """Test POST /tweetclaw/open-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/open-tab")
    print("="*60)

    client = APIClient()
    response = client.open_tab("home")

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print(f"✅ Tab opened successfully, tabId: {response.get('tabId')}")
        return True, response.get('tabId')
    else:
        print("❌ Failed to open tab")
        return False, None


def test_navigate_tab(tab_id=None):
    """Test POST /tweetclaw/navigate-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/navigate-tab")
    print("="*60)

    path = input("Enter path to navigate (default: notifications): ").strip()
    if not path:
        path = "notifications"

    client = APIClient()
    response = client.navigate_tab(path, tab_id)

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print(f"✅ Navigated successfully to {response.get('url')}")
        return True
    else:
        print("❌ Failed to navigate")
        return False


def test_close_tab(tab_id):
    """Test POST /tweetclaw/close-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/close-tab")
    print("="*60)

    if not tab_id:
        print("⏭️  Skipped (no tab ID)")
        return True

    confirm = input(f"Close tab {tab_id}? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        return True

    client = APIClient()
    response = client.close_tab(tab_id)

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print("✅ Tab closed successfully")
        return True
    else:
        print("❌ Failed to close tab")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Tab Control APIs")
    print("="*60)

    results = []

    # Test open tab
    passed, tab_id = test_open_tab()
    results.append(("Open Tab", passed))

    if tab_id:
        time.sleep(2)  # Wait for tab to fully load

        # Test navigate
        results.append(("Navigate Tab", test_navigate_tab(tab_id)))

        time.sleep(1)

        # Test close
        results.append(("Close Tab", test_close_tab(tab_id)))

    print("\n" + "="*60)
    print("Test Summary:")
    print("="*60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    total = len(results)
    passed_count = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed_count}/{total} tests passed")

    sys.exit(0 if passed_count == total else 1)
