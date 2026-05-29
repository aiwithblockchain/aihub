#!/usr/bin/env python3
"""Test XHS API 5: get_note_comments
Usage:
  python3 examples/xhs_test_5_comments.py <note_id>
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

if len(sys.argv) < 2:
    print("Usage: python3 examples/xhs_test_5_comments.py <note_id>")
    sys.exit(1)

client = ClawBotClient()

note_id = sys.argv[1]

# Step 1: get note detail to extract xsec_token
print(f"Step 1: get_note_by_id({note_id}) to fetch xsec_token...")
note_resp = client.xhs.get_note_by_id(note_id=note_id)
if not note_resp.get("success"):
    print(f"✗ Failed to get note: {note_resp}")
    sys.exit(1)

note_data = note_resp.get("data", {})
xsec_token = note_data.get("xsec_token", "")

if not xsec_token:
    print("✗ No xsec_token in note detail")
    sys.exit(1)

print(f"  note_id    : {note_id}")
print(f"  xsec_token : {xsec_token[:20]}...")

# Step 2: get comments
print(f"\nStep 2: get_note_comments...")
result = client.xhs.get_note_comments(note_id=note_id, xsec_token=xsec_token)
print(json.dumps(result, ensure_ascii=False, indent=2))
