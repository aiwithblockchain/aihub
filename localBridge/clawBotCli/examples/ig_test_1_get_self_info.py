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

# Go REST API 直接返回 payload，不包装 success/data
print(f"User ID:        {result.get('userId')}")
print(f"Username:       {result.get('username')}")
print(f"Full Name:      {result.get('fullName')}")
print(f"Followers:      {result.get('followerCount')}")
print(f"Following:      {result.get('followingCount')}")
print(f"Media Count:    {result.get('mediaCount')}")
print(f"Private:        {result.get('isPrivate')}")
print(f"Verified:       {result.get('isVerified')}")
print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))
