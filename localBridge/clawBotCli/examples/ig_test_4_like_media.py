#!/usr/bin/env python3
"""Test IG API 4: like_media (点赞媒体)

Usage:
  python3 examples/ig_test_4_like_media.py [media_id]

Prerequisites:
  - localBridge is running
  - Chrome extension (tweetClaw) is connected
  - Instagram is open and logged in

Note: This is a WRITE operation. Use with caution.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

# 需要提供 media_id
if len(sys.argv) < 2:
    print("Usage: python3 examples/ig_test_4_like_media.py <media_id>")
    print("Example: python3 examples/ig_test_4_like_media.py 1234567890")
    sys.exit(1)

media_id = sys.argv[1]

print("=" * 60)
print(f"Test: ig_like_media (点赞媒体)")
print(f"Media ID: {media_id}")
print("=" * 60)
print("⚠️  WARNING: This is a WRITE operation. Press Ctrl+C to cancel.")
print()

result = client.ig.like_media(media_id=media_id)

# Go REST API 直接返回 payload，不包装 success/data
print(f"Status: {result.get('success', result.get('status'))}")
print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))