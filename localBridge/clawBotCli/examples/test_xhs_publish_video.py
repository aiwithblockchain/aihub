#!/usr/bin/env python3
"""
Test XHS publish_video_note API.

Usage:
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --title "标题" --desc "描述"
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --private
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --topics "美食,旅行"
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --schedule 1800

Requirements:
    - creator.xiaohongshu.com tab must be open and signed in
    - www.xiaohongshu.com tab must be open (for x-rap-param calculation)

Notes:
    - --topics: comma-separated topic names; the script will search each topic to get its ID
    - --schedule: seconds from now to schedule the publish (e.g. 1800 = 30 minutes later)
"""

import sys
import os
import json
import base64
import argparse
import time

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


def resolve_topics(client: ClawBotClient, topic_names: list[str], title: str, desc: str) -> list[dict]:
    """Get recommended topics for the note, then filter by user-specified names."""
    # Use note title+desc to get recommendations (same API the creator page uses)
    query = f"{title} {desc}"
    result = client.xhs.search_topics(keyword=query)
    if not result.get("success"):
        print(f"  Warning: topic recommendation failed, skipping all topics")
        return []
    items = result.get("data", {}).get("topic_dto_list") or []
    print(f"  Got {len(items)} recommended topics: {[t['name'] for t in items]}")

    if not topic_names:
        return []

    # filter by user-specified names (case-insensitive)
    resolved = []
    for name in topic_names:
        name = name.strip()
        if not name:
            continue
        match = next((t for t in items if t.get("name", "").lower() == name.lower()), None)
        if match:
            print(f"  Matched: '{match['name']}' (id={match['id']})")
            resolved.append({"id": match["id"], "name": match["name"]})
        else:
            print(f"  Warning: '{name}' not in recommendations, skipping")
    return resolved


def main() -> int:
    parser = argparse.ArgumentParser(description="Test XHS publish_video_note API")
    parser.add_argument("--video", required=True, help="Path to video file to publish")
    parser.add_argument("--title", default="测试视频标题", help="Note title")
    parser.add_argument("--desc", default="这是一条测试视频笔记，可以忽略。", help="Note description")
    parser.add_argument("--private", action="store_true", help="Publish as private (privacy_type=1)")
    parser.add_argument("--privacy", type=int, default=None, help="Privacy type: 0=public, 1=private, 3=specific users, 4=friends")
    parser.add_argument("--privacy-user-ids", default="", help="Comma-separated user IDs for privacy_type=3")
    parser.add_argument("--topics", default="", help="Comma-separated topic names to attach")
    parser.add_argument("--cover", default="", help="Path to custom cover image file")
    parser.add_argument("--schedule", type=int, default=0, help="Seconds from now to schedule publish (0=immediate), or absolute Unix timestamp if > 1000000000")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"✗ Video file not found: {args.video}")
        return 1

    file_size = os.path.getsize(args.video)
    # Determine privacy_type: --privacy takes precedence over --private
    if args.privacy is not None:
        privacy_type = args.privacy
    elif args.private:
        privacy_type = 1
    else:
        privacy_type = 0
    privacy_user_ids = [u.strip() for u in args.privacy_user_ids.split(",") if u.strip()] if args.privacy_user_ids else []
    # If schedule > 1_000_000_000 treat as absolute Unix timestamp, else as seconds offset
    if args.schedule > 1_000_000_000:
        scheduled_publish_time = args.schedule
    elif args.schedule > 0:
        scheduled_publish_time = int(time.time()) + args.schedule
    else:
        scheduled_publish_time = None

    schedule_display = f'{scheduled_publish_time} (absolute)' if args.schedule > 1_000_000_000 else (f'+{args.schedule}s ({scheduled_publish_time})' if scheduled_publish_time else 'immediate')

    print("\n" + "=" * 60)
    print("  XHS Publish Video Note Test")
    print("=" * 60)
    print(f"  Video    : {args.video}")
    print(f"  Size     : {format_size(file_size)}")
    print(f"  Title    : {args.title}")
    print(f"  Desc     : {args.desc}")
    print(f"  Private  : {args.private}")
    print(f"  Privacy  : {privacy_type} (0=public,1=private,3=specific,4=friends)")
    if privacy_user_ids:
        print(f"  UserIDs  : {privacy_user_ids}")
    print(f"  Topics   : {args.topics or '(none)'}")
    print(f"  Schedule : {schedule_display}")
    print("=" * 60)

    print(f"\n🎬 Loading video ({format_size(file_size)})...")
    try:
        b64_data, mime_type = load_video_as_base64(args.video)
        print(f"✓ Loaded, mime={mime_type}, base64 len={len(b64_data)}")
    except Exception as e:
        print(f"✗ Failed to load video: {e}")
        return 1

    client = ClawBotClient()

    # Resolve topics
    topics = []
    if args.topics:
        print("\n🔍 Resolving topics...")
        topics = resolve_topics(client, args.topics.split(","), args.title, args.desc)
        print(f"✓ {len(topics)} topic(s) resolved")

    # Load custom cover
    cover = None
    if args.cover:
        if not os.path.exists(args.cover):
            print(f"✗ Cover file not found: {args.cover}")
            return 1
        ext = os.path.splitext(args.cover)[1].lower()
        cover_mime = {"jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
        with open(args.cover, "rb") as f:
            cover_b64 = base64.b64encode(f.read()).decode("utf-8")
        cover = {"base64": cover_b64, "mimeType": cover_mime}
        print(f"\n🖼 Cover loaded: {args.cover} ({cover_mime})")

    print("\n🚀 Publishing video note...")
    print("   (tweetClaw will extract metadata, upload video+cover, then publish)")

    try:
        result = client.xhs.publish_video_note(
            title=args.title,
            desc=args.desc,
            video={"base64": b64_data, "mimeType": mime_type},
            privacy_type=privacy_type,
            privacy_user_ids=privacy_user_ids if privacy_user_ids else None,
            topics=topics if topics else None,
            scheduled_publish_time=scheduled_publish_time,
            cover=cover,
        )
    except Exception as e:
        print(f"✗ Exception: {e}")
        return 1

    print("\n📋 Response:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if result.get("success"):
        data = result.get("data") or {}
        note_id = data.get("note_id") or data.get("id")
        print(f"\n✅ Published successfully!")
        if note_id:
            print(f"   Note ID: {note_id}")
        if scheduled_publish_time:
            print(f"   Scheduled at: {scheduled_publish_time}")
        return 0
    else:
        print(f"\n❌ Publish failed: {result.get('error') or result.get('msg', 'Unknown error')}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
