#!/usr/bin/env python3
"""Test XHS API 1: get_homefeed
Usage:
  python3 examples/xhs_test_1_homefeed.py
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

print("=" * 60)
print("Test 1: Get first page of homefeed")
print("=" * 60)

result1 = client.xhs.get_homefeed()
print(f"Success: {result1.get('success')}")

if result1.get('success'):
    data = result1.get('data', {})
    cursor_score = data.get('cursor_score', '')
    items = data.get('items', [])

    print(f"Cursor score: {cursor_score}")
    print(f"Items count: {len(items)}")

    if items:
        print("\nFirst 3 notes:")
        for i, item in enumerate(items[:3], 1):
            note_id = item.get('id', 'N/A')
            xsec_token = item.get('xsec_token', 'N/A')
            note_card = item.get('note_card', {})
            title = note_card.get('display_title', 'No title')
            user = note_card.get('user', {})
            nickname = user.get('nickname', 'Unknown')

            print(f"\n  {i}. {title[:50]}...")
            print(f"     ID: {note_id}")
            print(f"     Token: {xsec_token[:30]}...")
            print(f"     Author: {nickname}")

    print("\n" + "=" * 60)
    print("Test 2: Get second page (pagination)")
    print("=" * 60)

    result2 = client.xhs.get_homefeed(cursor_score=cursor_score)
    print(f"Success: {result2.get('success')}")

    if result2.get('success'):
        data2 = result2.get('data', {})
        cursor_score2 = data2.get('cursor_score', '')
        items2 = data2.get('items', [])

        print(f"New cursor score: {cursor_score2}")
        print(f"Items count: {len(items2)}")

        if items2:
            print("\nFirst note from page 2:")
            item = items2[0]
            note_id = item.get('id', 'N/A')
            xsec_token = item.get('xsec_token', 'N/A')
            note_card = item.get('note_card', {})
            title = note_card.get('display_title', 'No title')

            print(f"  Title: {title[:50]}...")
            print(f"  ID: {note_id}")
            print(f"  Token: {xsec_token[:30]}...")
else:
    print(f"Error: {result1.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result1, ensure_ascii=False, indent=2)}")
