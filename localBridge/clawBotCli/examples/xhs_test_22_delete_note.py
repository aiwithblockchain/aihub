#!/usr/bin/env python3
"""Test XHS API 22: delete_note (删除笔记)
Usage:
  python3 examples/xhs_test_22_delete_note.py <note_id>

Note:
  This API requires the creator tab (creator.xiaohongshu.com) to be open.

Examples:
  python3 examples/xhs_test_22_delete_note.py 6a1320ac000000003700f6c2
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_22_delete_note.py <note_id>")
    print("  note_id: The note ID to delete")
    print("  Note: creator.xiaohongshu.com tab must be open")
    sys.exit(1)

note_id = sys.argv[1]

print("=" * 60)
print(f"Test: delete_note (note_id={note_id})")
print("=" * 60)

result = client.xhs.delete_note(note_id=note_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
