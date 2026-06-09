#!/usr/bin/env python3
"""Test IG API 0: check_login (检查登录状态)

Usage:
  python3 examples/ig_test_0_check_login.py

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

print("=" * 60)
print("Test: ig_check_login (检查登录状态)")
print("=" * 60)

result = client.ig.get_status()

# Go REST API 直接返回 payload，不包装 success/data
isLoggedIn = result.get("isLoggedIn")
print(f"Is Logged In: {isLoggedIn}")

if isLoggedIn:
    print(f"User ID: {result.get('userId')}")
    print()
    print("Full response:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
else:
    print(f"Error: Not logged in or extension not connected")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
    sys.exit(1)