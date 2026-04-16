#!/usr/bin/env python3
"""
Test Tab Control APIs (Open Tab, Navigate Tab, Close Tab)
测试场景 9: 标签页控制测试
"""
import sys
import os
import json
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_open_tab():
    """Test POST /tweetclaw/open-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/open-tab")
    print("="*60)

    path = "home"
    print(f"Opening tab with path: {path}")

    client = ClawBotClient()
    tab = client.x.tabs.open(path)

    print(json.dumps(tab.raw, indent=2, ensure_ascii=False))

    if tab.tab_id:
        print(f"✅ Tab opened successfully")
        print(f"   Tab ID: {tab.tab_id}")
        print(f"   URL: {tab.raw.get('url')}")
        return True, tab.tab_id
    else:
        print("❌ Failed to open tab")
        return False, None


def test_navigate_tab(tab_id=None):
    """Test POST /tweetclaw/navigate-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/navigate-tab")
    print("="*60)

    path = "notifications"
    print(f"Navigating to path: {path}")
    if tab_id:
        print(f"Using tab ID: {tab_id}")

    client = ClawBotClient()
    result = client.x.tabs.navigate(path, tab_id)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False))

    if result.success:
        url = result.raw.get('url')
        print(f"✅ Navigation successful")
        print(f"   URL: {url}")
        return True
    else:
        print("❌ Navigation failed")
        return False


def test_close_tab(tab_id):
    """Test POST /tweetclaw/close-tab"""
    print("\n" + "="*60)
    print("Testing: POST /tweetclaw/close-tab")
    print("="*60)

    if not tab_id:
        print("⏭️  Skipped - No tab ID available")
        return True

    print(f"Closing tab ID: {tab_id}")

    client = ClawBotClient()
    result = client.x.tabs.close(tab_id)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False))

    if result.success:
        print("✅ Tab closed successfully")
        return True
    else:
        print("❌ Failed to close tab")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Tab Control APIs (Scenario 9)")
    print("="*60)

    results = []
    tab_id = None

    # Test 1: Open tab
    passed, tab_id = test_open_tab()
    results.append(("Open Tab", passed))

    if tab_id:
        # Wait for tab to load
        print("\n⏳ Waiting 2 seconds for tab to load...")
        time.sleep(2)

        # Test 2: Navigate tab
        results.append(("Navigate Tab", test_navigate_tab(tab_id)))

        # Wait before closing
        print("\n⏳ Waiting 1 second before closing...")
        time.sleep(1)

        # Test 3: Close tab
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
