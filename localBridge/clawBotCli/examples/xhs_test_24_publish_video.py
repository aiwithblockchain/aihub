#!/usr/bin/env python3
"""Test XHS API 24: publish_video_note (发布视频笔记)

Usage:
  python3 examples/xhs_test_24_publish_video.py --video path/to/video.mp4
  python3 examples/xhs_test_24_publish_video.py --video path/to/video.mp4 --title "标题" --desc "描述"
  python3 examples/xhs_test_24_publish_video.py --video path/to/video.mp4 --private
  python3 examples/xhs_test_24_publish_video.py --video path/to/video.mp4 --topics "美食,旅行"
  python3 examples/xhs_test_24_publish_video.py --video path/to/video.mp4 --schedule 1800
  python3 examples/xhs_test_24_publish_video.py --help

Requirements:
  - creator.xiaohongshu.com tab must be open and signed in
  - www.xiaohongshu.com tab must be open (for x-rap-param calculation)

Notes:
  - --topics: comma-separated topic names; the script will search each topic to get its ID
  - --schedule: seconds from now to schedule the publish (e.g. 1800 = 30 minutes later)
"""

import sys, os, json, base64, argparse, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def load_video_as_base64(path: str) -> tuple:
    """Load video file and return (base64_data, mime_type)."""
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
    """Format file size in human-readable format."""
    if n >= 1024 * 1024:
        return f"{n / 1024 / 1024:.1f} MB"
    return f"{n / 1024:.1f} KB"


def main():
    parser = argparse.ArgumentParser(description='Test XHS publish_video_note API')
    parser.add_argument('--video', required=True, help='Path to video file to publish')
    parser.add_argument('--title', default='测试视频标题', help='Note title')
    parser.add_argument('--desc', default='这是一条测试视频笔记，可以忽略。', help='Note description')
    parser.add_argument('--private', action='store_true', help='Publish as private (privacy_type=1)')
    parser.add_argument('--privacy', type=int, default=None, help='Privacy type: 0=public, 1=private, 3=specific users, 4=friends')
    parser.add_argument('--privacy-user-ids', default='', help='Comma-separated user IDs for privacy_type=3')
    parser.add_argument('--topics', default='', help='Comma-separated topic names to attach')
    parser.add_argument('--cover', default='', help='Path to custom cover image file')
    parser.add_argument('--schedule', type=int, default=0, help='Seconds from now to schedule publish (0=immediate), or absolute Unix timestamp if > 1000000000')

    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: Video file not found: {args.video}")
        return 1

    file_size = os.path.getsize(args.video)

    # Determine privacy_type
    if args.privacy is not None:
        privacy_type = args.privacy
    elif args.private:
        privacy_type = 1
    else:
        privacy_type = 0

    privacy_user_ids = [u.strip() for u in args.privacy_user_ids.split(",") if u.strip()] if args.privacy_user_ids else []

    # Calculate scheduled time
    if args.schedule > 1_000_000_000:
        scheduled_publish_time = args.schedule
        schedule_display = f'{scheduled_publish_time} (absolute)'
    elif args.schedule > 0:
        scheduled_publish_time = int(time.time()) + args.schedule
        schedule_display = f'+{args.schedule}s ({scheduled_publish_time})'
    else:
        scheduled_publish_time = None
        schedule_display = 'immediate'

    print("=" * 60)
    print("Test: Publish video note")
    print("=" * 60)
    print(f"Video: {args.video}")
    print(f"Size: {format_size(file_size)}")
    print(f"Title: {args.title}")
    print(f"Desc: {args.desc}")
    print(f"Privacy type: {privacy_type}")
    if privacy_user_ids:
        print(f"Privacy user IDs: {privacy_user_ids}")
    print(f"Schedule: {schedule_display}")
    if args.cover:
        print(f"Cover: {args.cover}")
    print("=" * 60)

    # Load video
    print("\nLoading video...")
    try:
        b64_data, mime_type = load_video_as_base64(args.video)
        print(f"Loaded: {format_size(file_size)}, mime={mime_type}")
    except Exception as e:
        print(f"Error: Failed to load video: {e}")
        return 1

    client = ClawBotClient()

    # Resolve topics if specified
    topics = []
    if args.topics:
        print("\nResolving topics...")
        topic_names = [t.strip() for t in args.topics.split(",") if t.strip()]
        query = f"{args.title} {args.desc}"
        result = client.xhs.search_topics(keyword=query)
        if result.get("success"):
            items = result.get("data", {}).get("topic_dto_list") or []
            print(f"Got {len(items)} recommended topics")
            for name in topic_names:
                match = next((t for t in items if t.get("name", "").lower() == name.lower()), None)
                if match:
                    print(f"  Matched: '{match['name']}' (id={match['id']})")
                    topics.append({"id": match["id"], "name": match["name"]})
                else:
                    print(f"  Warning: '{name}' not in recommendations, skipping")
        else:
            print("Warning: topic search failed, skipping topics")

    # Load custom cover
    cover = None
    if args.cover:
        if not os.path.exists(args.cover):
            print(f"Error: Cover file not found: {args.cover}")
            return 1
        ext = os.path.splitext(args.cover)[1].lower()
        cover_mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
        with open(args.cover, "rb") as f:
            cover_b64 = base64.b64encode(f.read()).decode("utf-8")
        cover = {"base64": cover_b64, "mimeType": cover_mime}
        print(f"\nCover loaded: {args.cover} ({cover_mime})")

    print("\nPublishing video note...")
    print("(tweetClaw will extract metadata, upload video+cover, then publish)")

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
        print(f"Exception: {e}")
        return 1

    print(f"\nSuccess: {result.get('success')}")

    if result.get('success'):
        data = result.get('data', {})
        note_id = data.get('note_id') or data.get('id')
        print(f"\nPublished successfully!")
        if note_id:
            print(f"Note ID: {note_id}")
        if scheduled_publish_time:
            print(f"Scheduled at: {scheduled_publish_time}")
        print("\nResponse:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    else:
        print(f"\nError: {result.get('error') or result.get('msg', 'Unknown error')}")
        print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return 1


if __name__ == '__main__':
    raise SystemExit(main())