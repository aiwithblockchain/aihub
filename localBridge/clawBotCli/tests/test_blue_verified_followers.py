#!/usr/bin/env python3
"""
Test script for GET /api/v1/x/blue_verified_followers

Usage:
    python tests/test_blue_verified_followers.py --userId 44196397
    python tests/test_blue_verified_followers.py --userId 44196397 --count 5
    python tests/test_blue_verified_followers.py --userId 44196397 --count 5 --cursor <cursor_string>
"""
import sys
import os
import json
import argparse

import requests

BASE_URL = "http://127.0.0.1:10088"
TIMEOUT = 15


def test_blue_verified_followers(user_id: str, count: int = 20, cursor: str = None):
    print("\n" + "=" * 60)
    print("Testing: GET /api/v1/x/blue_verified_followers")
    print("=" * 60)

    params = {"userId": user_id, "count": count}
    if cursor:
        params["cursor"] = cursor

    print(f"Request params: {params}")

    try:
        resp = requests.get(f"{BASE_URL}/api/v1/x/blue_verified_followers", params=params, timeout=TIMEOUT)
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection refused — is LocalBridge running on {BASE_URL}?")
        return False

    print(f"HTTP status: {resp.status_code}")

    if resp.status_code != 200:
        print(f"❌ Unexpected status code: {resp.status_code}")
        print(f"Body: {resp.text[:500]}")
        return False

    try:
        data = resp.json()
    except Exception as e:
        print(f"❌ Failed to parse JSON: {e}")
        print(f"Body: {resp.text[:500]}")
        return False

    print(f"\n✅ Response received (HTTP 200)")
    print(f"Top-level keys: {list(data.keys()) if isinstance(data, dict) else type(data).__name__}")

    # Print pretty JSON (truncated)
    raw_str = json.dumps(data, ensure_ascii=False, indent=2)
    if len(raw_str) > 2000:
        print(f"\nResponse (first 2000 chars):\n{raw_str[:2000]}\n... (truncated)")
    else:
        print(f"\nResponse:\n{raw_str}")

    # Basic structure check
    if isinstance(data, dict):
        if "data" in data or "errors" in data:
            print("\n✅ Twitter GraphQL envelope detected (data/errors key present)")
        else:
            print(f"\n⚠️  Unexpected top-level structure: {list(data.keys())}")

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test GET /api/v1/x/blue_verified_followers")
    parser.add_argument("--userId", required=True, help="Target user ID (numeric string, e.g. 44196397)")
    parser.add_argument("--count",  type=int, default=20, help="Page size (default: 20)")
    parser.add_argument("--cursor", type=str, default=None, help="Pagination cursor")
    args = parser.parse_args()

    print(f"\n🧪 Blue Verified Followers API Test")
    print(f"   Base URL : {BASE_URL}")
    print(f"   userId   : {args.userId}")
    print(f"   count    : {args.count}")
    print(f"   cursor   : {args.cursor or '(none — first page)'}")

    ok = test_blue_verified_followers(args.userId, args.count, args.cursor)

    print("\n" + "=" * 60)
    print("Result:", "✅ PASS" if ok else "❌ FAIL")
    sys.exit(0 if ok else 1)
