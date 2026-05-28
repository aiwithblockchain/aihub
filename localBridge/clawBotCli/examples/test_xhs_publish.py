#!/usr/bin/env python3
"""
Test XHS publish_note API.

Usage:
    python3 examples/test_xhs_publish.py --image path/to/image.jpg
    python3 examples/test_xhs_publish.py --image path/to/image.jpg --title "标题" --desc "描述"

Requirements:
    - creator.xiaohongshu.com tab must be open and signed in
    - www.xiaohongshu.com tab must be open (for x-rap-param calculation)
"""

import sys
import os
import json
import base64
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def load_image_as_base64(path: str) -> tuple[str, str]:
    """Load image file and return (base64_data, mime_type)."""
    ext = os.path.splitext(path)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    mime_type = mime_map.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return data, mime_type


def main() -> int:
    parser = argparse.ArgumentParser(description="Test XHS publish_note API")
    parser.add_argument("--image", required=True, help="Path to image file to publish")
    parser.add_argument("--title", default="测试标题", help="Note title (default: 测试标题)")
    parser.add_argument("--desc", default="这是一条测试笔记，可以忽略。", help="Note description")
    parser.add_argument("--private", action="store_true", help="Publish as private (privacy_type=1)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"✗ Image file not found: {args.image}")
        return 1

    print("\n" + "=" * 60)
    print("  XHS Publish Image Note Test")
    print("=" * 60)
    print(f"  Image : {args.image}")
    print(f"  Title : {args.title}")
    print(f"  Desc  : {args.desc}")
    print(f"  Private: {args.private}")
    print("=" * 60)

    # Load image
    print("\n📷 Loading image...")
    try:
        b64_data, mime_type = load_image_as_base64(args.image)
        print(f"✓ Loaded {os.path.getsize(args.image)} bytes, mime={mime_type}")
    except Exception as e:
        print(f"✗ Failed to load image: {e}")
        return 1

    client = ClawBotClient()

    print("\n🚀 Publishing note...")
    print("   (requires creator.xiaohongshu.com tab open and signed in)")

    try:
        result = client.xhs.publish_note(
            title=args.title,
            desc=args.desc,
            images=[{"base64": b64_data, "mimeType": mime_type}],
            privacy_type=1 if args.private else 0,
            topics=[],
        )
    except Exception as e:
        print(f"✗ Exception: {e}")
        return 1

    print("\n📋 Response:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if result.get("success"):
        data = result.get("data", {})
        note_id = data.get("note_id") or data.get("id")
        print(f"\n✅ Published successfully!")
        if note_id:
            print(f"   Note ID: {note_id}")
        return 0
    else:
        print(f"\n❌ Publish failed: {result.get('error') or result.get('msg', 'Unknown error')}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
