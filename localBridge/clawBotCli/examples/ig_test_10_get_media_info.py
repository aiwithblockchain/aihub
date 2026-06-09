#!/usr/bin/env python3
"""Test IG API: get_media_info (获取媒体详情)

Usage:
  python3 examples/ig_test_10_get_media_info.py <shortcode>

  shortcode 可以从 Instagram URL 中获取，例如：
  - https://www.instagram.com/p/DWxxh4pJHjK/ → shortcode 是 DWxxh4pJHjK
  - 或从 Feed API 返回的 code 字段获取

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

if len(sys.argv) < 2:
    print("❌ Error: shortcode is required")
    print()
    print("Usage:")
    print("  python3 examples/ig_test_10_get_media_info.py <shortcode>")
    print()
    print("Example:")
    print("  python3 examples/ig_test_10_get_media_info.py DWxxh4pJHjK")
    sys.exit(1)

client = ClawBotClient()
shortcode = sys.argv[1]

print("=" * 60)
print("Test: ig_get_media_info (获取媒体详情)")
print(f"Shortcode: {shortcode}")
print("=" * 60)

try:
    result = client.ig.get_media_info(shortcode=shortcode)

    print(f"✅ Success!")
    print()
    print(f"Media ID:       {result.get('id')}")
    print(f"PK:             {result.get('pk')}")
    print(f"Shortcode:      {result.get('shortcode')}")
    print(f"Type:           {result.get('mediaType')}")
    print(f"Like Count:     {result.get('likeCount')}")
    print(f"Comment Count:  {result.get('commentCount')}")
    print(f"Has Liked:      {result.get('hasLiked')}")
    print(f"Taken At:       {result.get('takenAt')}")
    print()
    print(f"User:")
    user = result.get('user', {})
    print(f"  ID:           {user.get('userId')}")
    print(f"  Username:     @{user.get('username')}")
    print(f"  Full Name:    {user.get('fullName')}")
    print()
    caption = result.get('caption', '')
    if caption:
        print(f"Caption:        {caption[:100]}{'...' if len(caption) > 100 else ''}")
    print()
    print("Full response:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)
