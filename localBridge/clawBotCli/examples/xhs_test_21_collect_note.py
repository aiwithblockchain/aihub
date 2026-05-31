#!/usr/bin/env python3
"""Test XHS API 21: collect_note (收藏笔记)
Usage:
  python3 examples/xhs_test_21_collect_note.py <note_id>

Examples:
  python3 examples/xhs_test_21_collect_note.py 6a1993f3000000003601ade8
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_21_collect_note.py <note_id>")
    sys.exit(1)

note_id = sys.argv[1]

print("=" * 60)
print(f"Test: collect_note (note_id={note_id})")
print("=" * 60)

result = client.xhs.collect_note(note_id=note_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
