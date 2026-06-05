#!/usr/bin/env python3
"""Test IG API 7: unfollow_user (取消关注)

Usage:
  python3 examples/ig_test_7_unfollow_user.py [user_id]

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

# 需要提供 user_id
if len(sys.argv) < 2:
    print("Usage: python3 examples/ig_test_7_unfollow_user.py <user_id>")
    print("Example: python3 examples/ig_test_7_unfollow_user.py 123456789")
    sys.exit(1)

user_id = sys.argv[1]

print("=" * 60)
print(f"Test: ig_unfollow_user (取消关注)")
print(f"User ID: {user_id}")
print("=" * 60)
print("⚠️  WARNING: This is a WRITE operation. Press Ctrl+C to cancel.")
print()

result = client.ig.unfollow_user(user_id=user_id)

# Go REST API 直接返回 payload，不包装 success/data
print(f"Following:      {result.get('following')}")
if 'friendshipStatus' in result:
    print(f"Friendship:     {result.get('friendshipStatus', {}).get('following')}")
print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))