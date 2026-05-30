#!/usr/bin/env python3
"""Test XHS API 19: unlike_note (取消点赞)
Usage:
  python3 examples/xhs_test_19_unlike_note.py <note_id>

Examples:
  python3 examples/xhs_test_19_unlike_note.py 6a1687f400000000360002ba
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_19_unlike_note.py <note_id>")
    sys.exit(1)

note_id = sys.argv[1]

print("=" * 60)
print(f"Test: unlike_note (note_id={note_id})")
print("=" * 60)

result = client.xhs.unlike_note(note_id=note_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    like_count = data.get("like_count")
    print(f"Like count after unlike: {like_count}")
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
