#!/usr/bin/env python3
"""Test IG API 3: search_user (搜索用户)

Usage:
  python3 examples/ig_test_3_search_user.py [username]

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

# 默认搜索 tweetpilot_ai，也可以传入其他用户名
username = sys.argv[1] if len(sys.argv) > 1 else "tweetpilot_ai"

print("=" * 60)
print(f"Test: ig_search_user (搜索用户)")
print(f"Username: {username}")
print("=" * 60)

result = client.ig.search_user(username=username)

# Go REST API 直接返回 payload，不包装 success/data
print(f"User ID:        {result.get('userId')}")
print(f"Username:       {result.get('username')}")
print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))