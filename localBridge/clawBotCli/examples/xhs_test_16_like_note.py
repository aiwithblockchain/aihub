#!/usr/bin/env python3
"""Test XHS API 16: like_note (点赞笔记)
Usage:
  python3 examples/xhs_test_16_like_note.py <note_id>
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_16_like_note.py <note_id>")
    sys.exit(1)

note_id = sys.argv[1]

print("=" * 60)
print(f"Test: like_note (note_id={note_id})")
print("=" * 60)

result = client.xhs.like_note(note_id=note_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    print(f"Code: {data.get('code', 'N/A')}")
    print(f"Message: {data.get('msg', 'N/A')}")
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
