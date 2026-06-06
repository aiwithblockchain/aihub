#!/usr/bin/env python3
"""Test Instagram Feed API via tweetClaw extension"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sdk.ig_client import IGClient


async def main():
    client = IGClient()
    print("[Test] Getting Instagram home feed...")

    result = await client.get_home_feed()

    items = result.get("items", [])
    print(f"[Test] Got {len(items)} feed items")

    for i, item in enumerate(items[:5]):
        print(f"\n[Item {i+1}]")
        print(f"  id: {item.get('id')}")
        print(f"  pk: {item.get('pk')}")
        print(f"  code: {item.get('code')}")
        print(f"  type: {item.get('mediaType')}")
        print(f"  user: {item.get('user', {}).get('username')}")
        print(f"  likes: {item.get('likeCount')}")
        print(f"  hasLiked: {item.get('hasLiked')}")

    next_cursor = result.get("nextMaxId")
    print(f"\n[Test] Next cursor: {next_cursor}")


if __name__ == "__main__":
    asyncio.run(main())
