#!/usr/bin/env python3
"""Test XHS API 5: get_note_comments - with xsec_token from published_notes
Usage:
  python3 examples/xhs_test_5_comments.py                        # auto-pick first published note
  python3 examples/xhs_test_5_comments.py <note_id> <xsec_token>  # explicit
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 3:
    note_id = sys.argv[1]
    xsec_token = sys.argv[2]
else:
    # Auto: get xsec_token from published_notes
    print("No args given — fetching xsec_token from published_notes...")
    notes_resp = client.xhs.get_published_notes()
    notes = notes_resp.get("data", {}).get("notes", [])
    if not notes:
        print("✗ No published notes found")
        sys.exit(1)
    first = notes[0]
    note_id = first.get("id")
    xsec_token = first.get("xsec_token", "")
    print(f"  note_id    : {note_id}")
    print(f"  xsec_token : {xsec_token}")

print(f"\nCalling get_note_comments(note_id={note_id}, xsec_token={xsec_token[:20]}...)")
result = client.xhs.get_note_comments(note_id=note_id, xsec_token=xsec_token)
print(json.dumps(result, ensure_ascii=False, indent=2))
