#!/usr/bin/env python3
"""Test XHS API 18: delete_comment (删除评论)
Usage:
  python3 examples/xhs_test_18_delete_comment.py <note_id> <comment_id>

Examples:
  python3 examples/xhs_test_18_delete_comment.py 6a1687f400000000360002ba 6a1aabe8000000002203fba1
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 3:
    print("Usage: python3 examples/xhs_test_18_delete_comment.py <note_id> <comment_id>")
    print("  note_id: The note ID the comment belongs to")
    print("  comment_id: The comment ID to delete")
    sys.exit(1)

note_id = sys.argv[1]
comment_id = sys.argv[2]

print("=" * 60)
print(f"Test: delete_comment (note_id={note_id}, comment_id={comment_id})")
print("=" * 60)

result = client.xhs.delete_comment(note_id=note_id, comment_id=comment_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    print(f"Full response: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
