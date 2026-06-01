#!/usr/bin/env python3
"""
Test XHS collection management APIs.

Usage:
    # List existing collections
    python3 examples/test_xhs_collection.py --action list

    # Create a collection (no cover)
    python3 examples/test_xhs_collection.py --action create --name "测试合集" --desc "这是一个测试合集"

    # Create a collection with cover image
    python3 examples/test_xhs_collection.py --action create --name "测试合集" --desc "描述" --cover path/to/cover.jpg

    # List notes in a collection
    python3 examples/test_xhs_collection.py --action list_notes --collection-id 6a1d1c310518000000000001

    # Update a collection name/desc
    python3 examples/test_xhs_collection.py --action update --collection-id 6a1d1c310518000000000001 --name "新名称" --desc "新描述"

    # Get friend/fans list (for privacy type=3)
    python3 examples/test_xhs_collection.py --action friend_fans

Requirements:
    - creator.xiaohongshu.com tab must be open and signed in
    - www.xiaohongshu.com tab must be open
"""

import sys
import os
import json
import base64
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def load_image_as_base64(path: str) -> tuple[str, str]:
    ext = os.path.splitext(path)[1].lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    mime_type = mime_map.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return data, mime_type


def main() -> int:
    parser = argparse.ArgumentParser(description="Test XHS collection management APIs")
    parser.add_argument("--action", required=True,
                        choices=["list", "create", "list_notes", "update", "friend_fans"],
                        help="Action to perform")
    parser.add_argument("--name", default="", help="Collection name (for create/update)")
    parser.add_argument("--desc", default="", help="Collection description (for create/update)")
    parser.add_argument("--cover", default="", help="Path to cover image (for create/update)")
    parser.add_argument("--collection-id", default="", help="Collection ID (for list_notes/update)")
    parser.add_argument("--cursor", default="", help="Pagination cursor (for list/friend_fans)")
    args = parser.parse_args()

    client = ClawBotClient()

    print(f"\n{'='*60}")
    print(f"  XHS Collection Test — action={args.action}")
    print(f"{'='*60}\n")

    if args.action == "list":
        print("📋 Listing collections...")
        result = client.xhs.list_collections(cursor=args.cursor)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("success"):
            items = result.get("data", {}).get("collection_info_list", [])
            print(f"\n✅ Found {len(items)} collection(s):")
            for c in items:
                print(f"  - [{c.get('id')}] {c.get('name')} ({c.get('note_num', 0)} notes)")
        else:
            print(f"\n❌ Failed: {result.get('error')}")
            return 1

    elif args.action == "create":
        if not args.name:
            print("✗ --name is required for create")
            return 1
        cover = None
        if args.cover:
            if not os.path.exists(args.cover):
                print(f"✗ Cover file not found: {args.cover}")
                return 1
            b64, mime = load_image_as_base64(args.cover)
            cover = {"base64": b64, "mimeType": mime}
            print(f"🖼  Cover loaded: {args.cover} ({mime})")

        print(f"📁 Creating collection: name='{args.name}' desc='{args.desc}'")
        result = client.xhs.create_collection(name=args.name, desc=args.desc, cover=cover)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("success"):
            collection_id = result.get("data", {}).get("collection_id")
            print(f"\n✅ Created! collection_id={collection_id}")
        else:
            print(f"\n❌ Failed: {result.get('error')}")
            return 1

    elif args.action == "list_notes":
        if not args.collection_id:
            print("✗ --collection-id is required for list_notes")
            return 1
        print(f"📄 Listing notes in collection: {args.collection_id}")
        result = client.xhs.list_collection_notes(collection_id=args.collection_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("success"):
            print(f"\n✅ Done")
        else:
            print(f"\n❌ Failed: {result.get('error')}")
            return 1

    elif args.action == "update":
        if not args.collection_id:
            print("✗ --collection-id is required for update")
            return 1
        if not args.name:
            print("✗ --name is required for update")
            return 1
        cover = None
        if args.cover:
            if not os.path.exists(args.cover):
                print(f"✗ Cover file not found: {args.cover}")
                return 1
            b64, mime = load_image_as_base64(args.cover)
            cover = {"base64": b64, "mimeType": mime}
            print(f"🖼  New cover loaded: {args.cover}")

        print(f"✏️  Updating collection {args.collection_id}: name='{args.name}'")
        result = client.xhs.update_collection(
            collection_id=args.collection_id,
            name=args.name,
            desc=args.desc,
            cover=cover,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("success"):
            print(f"\n✅ Updated!")
        else:
            print(f"\n❌ Failed: {result.get('error')}")
            return 1

    elif args.action == "friend_fans":
        print("👥 Getting friend/fans list...")
        result = client.xhs.get_friend_fans(cursor=args.cursor)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("success"):
            users = result.get("data", {}).get("user_list", [])
            print(f"\n✅ Found {len(users)} user(s):")
            for u in users:
                print(f"  - [{u.get('user_id')}] {u.get('nick_name')}")
        else:
            print(f"\n❌ Failed: {result.get('error')}")
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
