#!/usr/bin/env python3
"""Test XHS API 7: get_feed (笔记详情)
Usage:
  python3 examples/xhs_test_7_feed.py <note_id> <xsec_token>
  python3 examples/xhs_test_7_feed.py             # auto-pick from homefeed
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 3:
    note_id = sys.argv[1]
    xsec_token = sys.argv[2]
    print(f"Using provided note_id={note_id}")
else:
    print("Step 1: get_homefeed to pick note_id and xsec_token...")
    feed_resp = client.xhs.get_homefeed()
    if not feed_resp.get("success"):
        print(f"✗ homefeed failed: {feed_resp}")
        sys.exit(1)
    items = feed_resp.get("data", {}).get("items", [])
    note_id, xsec_token = None, None
    for item in items:
        if item.get("id") and item.get("xsec_token"):
            note_id = item["id"]
            xsec_token = item["xsec_token"]
            break
    if not note_id:
        print("✗ No note with xsec_token found in homefeed")
        sys.exit(1)
    print(f"  note_id    : {note_id}")
    print(f"  xsec_token : {xsec_token[:20]}...")

print("\n" + "=" * 60)
print("Test: get_feed (笔记详情)")
print("=" * 60)

result = client.xhs.get_feed(note_id=note_id, xsec_token=xsec_token)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    items = data.get("items", [])
    if items:
        note = items[0].get("note_card", {})
        print(f"Title      : {note.get('title', 'N/A')}")
        print(f"Desc       : {str(note.get('desc', ''))[:80]}")
        print(f"Type       : {note.get('type', 'N/A')}")
        user = note.get("user", {})
        print(f"Author     : {user.get('nickname', 'N/A')} ({user.get('user_id', 'N/A')})")
        interact = note.get("interact_info", {})
        print(f"Likes      : {interact.get('liked_count', 'N/A')}")
        print(f"Comments   : {interact.get('comment_count', 'N/A')}")
        print(f"Collected  : {interact.get('collected_count', 'N/A')}")
    else:
        print("No items in response")
        print(json.dumps(data, ensure_ascii=False, indent=2))
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
