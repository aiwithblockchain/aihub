#!/usr/bin/env python3
"""Test XHS get intimacy list API."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    client = ClawBotClient()

    print("=" * 60)
    print("Test: get intimacy list (full friends list)")
    print("=" * 60)

    result = client.xhs.get_intimacy_list()

    success = result.get("success", False)
    print(f"Success: {success}")

    if success:
        data = result.get("data", {})
        items = data.get("items", [])
        print(f"Total friends: {len(items)}")
        print()

        for i, item in enumerate(items[:20]):  # Show first 20
            rid = item.get("rid", "")
            userid = item.get("userid", "")
            nickname = item.get("nickname", "")
            print(f"{i+1:3}. {nickname}")
            print(f"     rid: {rid}")
            print(f"     userid: {userid}")
            print()

        if len(items) > 20:
            print(f"... and {len(items) - 20} more friends")
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")


if __name__ == "__main__":
    main()
