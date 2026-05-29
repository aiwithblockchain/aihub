#!/usr/bin/env python3
"""Test XHS API 12: search_filter (搜索过滤器)
Usage:
  python3 examples/xhs_test_12_search_filter.py <keyword>
  python3 examples/xhs_test_12_search_filter.py   # default keyword: 美食
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

keyword = sys.argv[1] if len(sys.argv) >= 2 else "美食"

print("=" * 60)
print(f"Test: search_filter (keyword={keyword})")
print("=" * 60)

result = client.xhs.search_filter(keyword=keyword)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    filters = data.get("filters", data.get("filter_items", []))
    print(f"Filter groups count: {len(filters)}")
    for i, group in enumerate(filters[:5], 1):
        name = group.get("name", "N/A")
        items = group.get("filter_tags", group.get("items", []))
        print(f"\n  {i}. {name} ({len(items)} options)")
        for opt in items[:3]:
            opt_name = opt.get("name", "N/A")
            opt_id = opt.get("id", "N/A")
            print(f"       - {opt_name} (id={opt_id})")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
