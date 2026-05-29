#!/usr/bin/env python3
"""Test XHS API 5: get_note_comments
Usage:
  python3 examples/xhs_test_5_comments.py <note_id> <xsec_token>
  python3 examples/xhs_test_5_comments.py             # auto-pick from homefeed
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 3:
    note_id = sys.argv[1]
    xsec_token = sys.argv[2]
    print(f"Using provided note_id={note_id}")
else:
    # Step 1: get xsec_token from homefeed
    print("Step 1: get_homefeed to fetch note_id and xsec_token...")
    feed_resp = client.xhs.get_homefeed()
    if not feed_resp.get("success"):
        print(f"✗ homefeed failed: {feed_resp}")
        sys.exit(1)

    items = feed_resp.get("data", {}).get("items", [])
    note_id = None
    xsec_token = None
    for item in items:
        if item.get("id") and item.get("xsec_token"):
            note_id = item["id"]
            xsec_token = item["xsec_token"]
            break

    if not note_id or not xsec_token:
        print("✗ No note with xsec_token found in homefeed")
        sys.exit(1)

    print(f"  note_id    : {note_id}")
    print(f"  xsec_token : {xsec_token[:20]}...")

# Step 2: get comments
print(f"\nStep 2: get_note_comments...")
result = client.xhs.get_note_comments(note_id=note_id, xsec_token=xsec_token)
print(json.dumps(result, ensure_ascii=False, indent=2))
