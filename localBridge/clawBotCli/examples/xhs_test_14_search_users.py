#!/usr/bin/env python3
"""Test XHS API 14: search_users (搜索用户，用于@用户)
Usage:
  python3 examples/xhs_test_14_search_users.py <keyword>
  python3 examples/xhs_test_14_search_users.py   # default keyword: 大梦
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

keyword = sys.argv[1] if len(sys.argv) >= 2 else "大梦"

print("=" * 60)
print(f"Test: search_users (keyword={keyword})")
print("=" * 60)

result = client.xhs.search_users(keyword=keyword)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    items = data.get("items", [])
    print(f"Users found: {len(items)}")

    for i, user in enumerate(items[:5], 1):
        nickname = user.get("nickname", "N/A")
        userid = user.get("userid", "N/A")
        rid = user.get("rid", "N/A")
        print(f"\n  {i}. {nickname}")
        print(f"     rid (真实ID): {rid}")
        print(f"     userid (带后缀，用于@): {userid}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
