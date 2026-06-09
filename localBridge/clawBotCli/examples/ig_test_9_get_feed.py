#!/usr/bin/env python3
"""Test IG API: get_feed (获取首页 Feed)

Usage:
  python3 examples/ig_test_get_feed.py [max_id]

Prerequisites:
  - localBridge is running
  - Chrome extension (tweetClaw) is connected
  - Instagram is open and logged in
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

max_id = sys.argv[1] if len(sys.argv) > 1 else None

print("=" * 60)
print("Test: ig_get_feed (获取首页 Feed)")
if max_id:
    print(f"Max ID: {max_id}")
print("=" * 60)

result = client.ig.get_feed(max_id=max_id)

items = result.get("items", [])
next_max_id = result.get("nextMaxId")

print(f"Feed Items: {len(items)}")
print(f"Next Max ID: {next_max_id}")
print()

if items:
    print("First 3 items:")
    for i, item in enumerate(items[:3]):
        print(f"\n--- Item {i+1} ---")
        print(f"Media ID:   {item.get('id')}")
        print(f"Shortcode:  {item.get('code')}")
        print(f"Type:       {item.get('mediaType')}")
        print(f"User:       @{item.get('user', {}).get('username')}")
        print(f"Caption:    {item.get('caption', '')[:50]}...")
        print(f"Likes:      {item.get('likeCount')}")
        print(f"Comments:   {item.get('commentCount')}")
        print(f"Has Liked:  {item.get('hasLiked')}")
else:
    print("No items in feed")

print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))