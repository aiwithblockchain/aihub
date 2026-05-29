#!/usr/bin/env python3
"""Test XHS API 11: search (搜索笔记) — 专属测试文件
Usage:
  python3 examples/xhs_test_11_search.py <keyword>
  python3 examples/xhs_test_11_search.py   # default keyword: 美食
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

keyword = sys.argv[1] if len(sys.argv) >= 2 else "美食"

print("=" * 60)
print(f"Test 1: search notes (keyword={keyword}, page_size=10)")
print("=" * 60)

result = client.xhs.search(keyword=keyword, page_size=20)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    items = data.get("items", [])
    cursor = data.get("cursor", "")
    has_more = data.get("has_more", False)
    print(f"Items count : {len(items)}")
    print(f"Has more    : {has_more}")
    print(f"Cursor      : {cursor[:30] if cursor else 'N/A'}")

    for i, item in enumerate(items[:3], 1):
        note_id = item.get("id", "N/A")
        xsec_token = item.get("xsec_token", "N/A")
        note_card = item.get("note_card", {})
        title = note_card.get("display_title", "No title")
        user = note_card.get("user", {})
        nickname = user.get("nickname", "Unknown")
        print(f"\n  {i}. {title[:50]}")
        print(f"     ID         : {note_id}")
        print(f"     xsec_token : {xsec_token[:20]}...")
        print(f"     Author     : {nickname}")

    if has_more and cursor:
        print("\n" + "=" * 60)
        print("Test 2: search notes (第二页)")
        print("=" * 60)
        result2 = client.xhs.search(keyword=keyword, page_size=10, cursor=cursor)
        print(f"Success: {result2.get('success')}")
        if result2.get("success"):
            items2 = result2.get("data", {}).get("items", [])
            print(f"Items count : {len(items2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
