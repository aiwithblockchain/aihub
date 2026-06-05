#!/usr/bin/env python3
"""Test IG API 1: get_self_info (获取当前用户信息)

Usage:
  python3 examples/ig_test_1_get_self_info.py

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
print("Test: ig_get_self_info (获取当前用户信息)")
print("=" * 60)

result = client.ig.get_account_info()
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    print(f"User ID:        {data.get('userId')}")
    print(f"Username:       {data.get('username')}")
    print(f"Full Name:      {data.get('fullName')}")
    print(f"Followers:      {data.get('followerCount')}")
    print(f"Following:      {data.get('followingCount')}")
    print(f"Media Count:    {data.get('mediaCount')}")
    print(f"Private:        {data.get('isPrivate')}")
    print(f"Verified:       {data.get('isVerified')}")
    print()
    print("Full response:")
    print(json.dumps(data, ensure_ascii=False, indent=2))
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
    sys.exit(1)
