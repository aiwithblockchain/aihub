#!/usr/bin/env python3
"""Test XHS API 17: follow_user (关注用户)
Usage:
  python3 examples/xhs_test_17_follow_user.py <target_user_id>

Examples:
  python3 examples/xhs_test_17_follow_user.py 656c6ea2000000001902c032
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_17_follow_user.py <target_user_id>")
    print("  target_user_id: The user rid (without hash suffix)")
    sys.exit(1)

target_user_id = sys.argv[1]

print("=" * 60)
print(f"Test: follow_user (target_user_id={target_user_id})")
print("=" * 60)

result = client.xhs.follow_user(target_user_id=target_user_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    fstatus = data.get("fstatus")
    print(f"Follow status: {fstatus}")
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
