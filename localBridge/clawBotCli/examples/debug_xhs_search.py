#!/usr/bin/env python3
"""
Debug script to test XHS search API with detailed logging
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def main():
    client = ClawBotClient()

    print("=" * 60)
    print("Testing XHS Search API")
    print("=" * 60)

    # Test 1: Simple search
    print("\n[TEST 1] Simple search for '美食'")
    result = client.xhs.search(keyword="美食", page_size=5)
    print(f"\nRaw response:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # Test 2: Check if it's a success/error response
    if result.get('success'):
        print(f"\n✓ Success: {result.get('success')}")
        data = result.get('data', {})
        items = data.get('items', [])
        print(f"  Items count: {len(items)}")
        print(f"  Cursor: {data.get('cursor')}")
    else:
        print(f"\n✗ Failed")
        print(f"  Code: {result.get('code')}")
        print(f"  Message: {result.get('message')}")
        print(f"  Details: {result.get('details')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
