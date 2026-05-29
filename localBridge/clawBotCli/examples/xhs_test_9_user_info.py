#!/usr/bin/env python3
"""Test XHS API 9: get_user_info (他人用户信息)
Usage:
  python3 examples/xhs_test_9_user_info.py <user_id>
  python3 examples/xhs_test_9_user_info.py   # auto-pick user from homefeed
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 2:
    user_id = sys.argv[1]
    print(f"Using provided user_id={user_id}")
else:
    print("Step 1: get_homefeed to pick user_id...")
    feed_resp = client.xhs.get_homefeed()
    if not feed_resp.get("success"):
        print(f"✗ homefeed failed: {feed_resp}")
        sys.exit(1)
    items = feed_resp.get("data", {}).get("items", [])
    user_id = None
    for item in items:
        uid = item.get("note_card", {}).get("user", {}).get("user_id")
        if uid:
            user_id = uid
            nickname = item.get("note_card", {}).get("user", {}).get("nickname", "")
            print(f"  user_id  : {user_id}  ({nickname})")
            break
    if not user_id:
        print("✗ No user_id found in homefeed")
        sys.exit(1)

print("\n" + "=" * 60)
print("Test: get_user_info (他人用户信息)")
print("=" * 60)

result = client.xhs.get_user_info(user_id=user_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    basic = data.get("basic_info", {})
    interactions = {i["type"]: i for i in data.get("interactions", [])}
    print(f"Nickname    : {basic.get('nickname', 'N/A')}")
    print(f"User ID     : {basic.get('red_id', 'N/A')}")
    print(f"Description : {str(basic.get('desc', ''))[:80]}")
    print(f"Following   : {interactions.get('follows', {}).get('count', 'N/A')}")
    print(f"Followers   : {interactions.get('fans', {}).get('count', 'N/A')}")
    print(f"Liked       : {interactions.get('interaction', {}).get('count', 'N/A')}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
