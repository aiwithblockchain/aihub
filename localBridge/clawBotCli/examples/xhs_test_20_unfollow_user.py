#!/usr/bin/env python3
"""Test XHS API 20: unfollow_user (取消关注)
Usage:
  python3 examples/xhs_test_20_unfollow_user.py <target_user_id>

Examples:
  python3 examples/xhs_test_20_unfollow_user.py 60575efd0000000001006809
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_20_unfollow_user.py <target_user_id>")
    print("  target_user_id: The user rid (without hash suffix)")
    sys.exit(1)

target_user_id = sys.argv[1]

print("=" * 60)
print(f"Test: unfollow_user (target_user_id={target_user_id})")
print("=" * 60)

result = client.xhs.unfollow_user(target_user_id=target_user_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    fstatus = data.get("fstatus")
    print(f"Follow status: {fstatus}")
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
