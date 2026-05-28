#!/usr/bin/env python3
"""
Test XHS publish_video_note API.

Usage:
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --title "标题" --desc "描述"
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --private

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


def load_video_as_base64(path: str) -> tuple[str, str]:
    ext = os.path.splitext(path)[1].lower()
    mime_map = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    }
    mime_type = mime_map.get(ext, "video/mp4")
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return data, mime_type


def format_size(n: int) -> str:
    if n >= 1024 * 1024:
        return f"{n / 1024 / 1024:.1f} MB"
    return f"{n / 1024:.1f} KB"


def main() -> int:
    parser = argparse.ArgumentParser(description="Test XHS publish_video_note API")
    parser.add_argument("--video", required=True, help="Path to video file to publish")
    parser.add_argument("--title", default="测试视频标题", help="Note title")
    parser.add_argument("--desc", default="这是一条测试视频笔记，可以忽略。", help="Note description")
    parser.add_argument("--private", action="store_true", help="Publish as private (privacy_type=1)")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"✗ Video file not found: {args.video}")
        return 1

    file_size = os.path.getsize(args.video)

    print("\n" + "=" * 60)
    print("  XHS Publish Video Note Test")
    print("=" * 60)
    print(f"  Video  : {args.video}")
    print(f"  Size   : {format_size(file_size)}")
    print(f"  Title  : {args.title}")
    print(f"  Desc   : {args.desc}")
    print(f"  Private: {args.private}")
    print("=" * 60)

    print(f"\n🎬 Loading video ({format_size(file_size)})...")
    try:
        b64_data, mime_type = load_video_as_base64(args.video)
        print(f"✓ Loaded, mime={mime_type}, base64 len={len(b64_data)}")
    except Exception as e:
        print(f"✗ Failed to load video: {e}")
        return 1

    client = ClawBotClient()

    print("\n🚀 Publishing video note...")
    print("   (tweetClaw will extract metadata, upload video+cover, then publish)")

    try:
        result = client.xhs.publish_video_note(
            title=args.title,
            desc=args.desc,
            video={"base64": b64_data, "mimeType": mime_type},
            privacy_type=1 if args.private else 0,
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

