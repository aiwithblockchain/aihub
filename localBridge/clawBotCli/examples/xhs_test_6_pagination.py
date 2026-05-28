#!/usr/bin/env python3
"""Test XHS API 6: get_published_notes pagination - prints raw response
Usage: python3 examples/xhs_test_6_pagination.py <cursor>
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

cursor = sys.argv[1] if len(sys.argv) > 1 else None
print(f"cursor: {cursor}")

client = ClawBotClient()
result = client.xhs.get_published_notes(cursor=cursor)
print(json.dumps(result, ensure_ascii=False, indent=2))
