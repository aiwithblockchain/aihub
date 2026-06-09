#!/usr/bin/env python3
"""Test IG API 2: get_user_info (获取指定用户信息)

Usage:
  python3 examples/ig_test_2_get_user_info.py [user_id]

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

# 默认使用当前用户 ID，也可以传入其他用户 ID
user_id = sys.argv[1] if len(sys.argv) > 1 else "27233003055"

print("=" * 60)
print(f"Test: ig_get_user_info (获取用户信息)")
print(f"User ID: {user_id}")
print("=" * 60)

result = client.ig.get_user_info(user_id=user_id)

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