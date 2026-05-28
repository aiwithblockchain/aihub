#!/usr/bin/env python3
"""Test XHS API 5: get_note_comments - prints raw response
Usage: python3 examples/xhs_test_5_comments.py <note_id>
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

note_id = sys.argv[1] if len(sys.argv) > 1 else "6a13d6cb00000000060217c3"
print(f"note_id: {note_id}")

client = ClawBotClient()
result = client.xhs.get_note_comments(note_id=note_id)
print(json.dumps(result, ensure_ascii=False, indent=2))
