#!/usr/bin/env python3
"""Test XHS API 8: get_user_notes (他人发布笔记列表)
Usage:
  python3 examples/xhs_test_8_user_notes.py <user_id> <xsec_token>
  python3 examples/xhs_test_8_user_notes.py   # auto-pick user from homefeed
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 3:
    user_id = sys.argv[1]
    xsec_token = sys.argv[2]
    print(f"Using provided user_id={user_id}")
else:
    print("Step 1: get_homefeed to pick user_id and xsec_token...")
    feed_resp = client.xhs.get_homefeed()
    if not feed_resp.get("success"):
        print(f"✗ homefeed failed: {feed_resp}")
        sys.exit(1)
    items = feed_resp.get("data", {}).get("items", [])
    user_id, xsec_token = None, None
    for item in items:
        note_card = item.get("note_card", {})
        user = note_card.get("user", {})
        uid = user.get("user_id")
        tok = user.get("xsec_token")
        if uid and tok:
            user_id = uid
            xsec_token = tok
            nickname = user.get("nickname", "")
            print(f"  user_id    : {user_id}  ({nickname})")
            print(f"  xsec_token : {xsec_token[:20]}...")
            break
    if not user_id or not xsec_token:
        print("✗ No user with xsec_token found in homefeed")
        sys.exit(1)

print("\n" + "=" * 60)
print("Test: get_user_notes (第一页)")
print("=" * 60)

result = client.xhs.get_user_notes(user_id=user_id, xsec_token=xsec_token)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    notes = data.get("notes", [])
    cursor = data.get("cursor", "")
    has_more = data.get("has_more", False)
    print(f"Notes count : {len(notes)}")
    print(f"Has more    : {has_more}")
    print(f"Cursor      : {cursor[:30] if cursor else 'N/A'}")
    for i, note in enumerate(notes[:3], 1):
        print(f"\n  {i}. {note.get('display_title', 'No title')[:50]}")
        print(f"     ID         : {note.get('note_id', 'N/A')}")
        print(f"     xsec_token : {note.get('xsec_token', 'N/A')[:20]}...")
        print(f"     Type       : {note.get('type', 'N/A')}")

    if has_more and cursor:
        print("\n" + "=" * 60)
        print("Test: get_user_notes (第二页)")
        print("=" * 60)
        result2 = client.xhs.get_user_notes(user_id=user_id, cursor=cursor, xsec_token=xsec_token)
        print(f"Success: {result2.get('success')}")
        if result2.get("success"):
            data2 = result2.get("data", {})
            notes2 = data2.get("notes", [])
            print(f"Notes count : {len(notes2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
