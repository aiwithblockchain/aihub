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


NAVIGATE_WAIT_SECONDS = 5


def list_x_tabs(client: ClawBotClient, label: str):
    """Print current X tabs and return them."""
    print("\n" + "="*60)
    print(f"Checking X tabs: {label}")
    print("="*60)

    tabs = client.x.status.list_tabs()
    print(f"Found {len(tabs)} X tab(s)")
    for index, tab in enumerate(tabs, 1):
        print(f"  [{index}] tabId={tab.tab_id} title={tab.title!r} url={tab.url!r}")
    return tabs



def has_tab(tabs, tab_id):
    return any(tab.tab_id == tab_id for tab in tabs)



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
    client = ClawBotClient()

    # Test 1: Open tab
    passed, tab_id = test_open_tab()
    results.append(("Open Tab", passed))

    if tab_id:
        # Wait for tab to load
        print(f"\n⏳ Waiting {NAVIGATE_WAIT_SECONDS} seconds for tab to load before verification...")
        time.sleep(NAVIGATE_WAIT_SECONDS)

        tabs_after_open = list_x_tabs(client, "after open-tab")
        opened_tab_present = has_tab(tabs_after_open, tab_id)
        if opened_tab_present:
            print(f"✅ Opened tab {tab_id} is present in current X tabs")
        else:
            print(f"❌ Opened tab {tab_id} is missing from current X tabs")
        results.append(("Verify Opened Tab Present", opened_tab_present))

        # Test 2: Navigate tab
        results.append(("Navigate Tab", test_navigate_tab(tab_id)))

        print(f"\n⏳ Waiting {NAVIGATE_WAIT_SECONDS} seconds after navigation for visual verification...")
        time.sleep(NAVIGATE_WAIT_SECONDS)

        tabs_after_navigate = list_x_tabs(client, "after navigate-tab")
        navigated_tab_present = has_tab(tabs_after_navigate, tab_id)
        if navigated_tab_present:
            print(f"✅ Navigated tab {tab_id} is still present before close")
        else:
            print(f"❌ Navigated tab {tab_id} is missing before close")
        results.append(("Verify Tab Present Before Close", navigated_tab_present))

        # Test 3: Close tab
        close_passed = test_close_tab(tab_id)
        results.append(("Close Tab", close_passed))

        print("\n⏳ Waiting 2 seconds after close before final verification...")
        time.sleep(2)

        tabs_after_close = list_x_tabs(client, "after close-tab")
        closed_tab_absent = not has_tab(tabs_after_close, tab_id)
        if closed_tab_absent:
            print(f"✅ Closed tab {tab_id} is no longer present in current X tabs")
        else:
            print(f"❌ Closed tab {tab_id} is still present in current X tabs")
        results.append(("Verify Closed Tab Removed", closed_tab_absent))

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
