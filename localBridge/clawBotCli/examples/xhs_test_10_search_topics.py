#!/usr/bin/env python3
"""Test XHS API 10: search_topics (搜索话题)
Usage:
  python3 examples/xhs_test_10_search_topics.py <keyword>
  python3 examples/xhs_test_10_search_topics.py   # default keyword: 美食
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

keyword = sys.argv[1] if len(sys.argv) >= 2 else "美食"

print("=" * 60)
print(f"Test: search_topics (keyword={keyword})")
print("=" * 60)

result = client.xhs.search_topics(keyword=keyword)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    topics = data.get("topic_dto_list", data.get("topic_info_dtos", data.get("topics", [])))
    print(f"Topics count: {len(topics)}")
    for i, topic in enumerate(topics[:5], 1):
        name = topic.get("name", topic.get("topic_name", "N/A"))
        topic_id = topic.get("id", topic.get("topic_id", "N/A"))
        view_num = topic.get("discuss_num", topic.get("view_num", "N/A"))
        print(f"\n  {i}. {name}")
        print(f"     ID        : {topic_id}")
        print(f"     View num  : {view_num}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
