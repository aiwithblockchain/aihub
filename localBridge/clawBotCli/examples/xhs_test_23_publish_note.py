#!/usr/bin/env python3
"""Test XHS API 23: publish_note (发布图文笔记)

Usage:
  python3 examples/xhs_test_23_publish_note.py --image path/to/image.jpg
  python3 examples/xhs_test_23_publish_note.py --image path/to/image.jpg --title "标题" --desc "描述"
  python3 examples/xhs_test_23_publish_note.py --image path/to/image.jpg --private
  python3 examples/xhs_test_23_publish_note.py --help

Requirements:
  - creator.xiaohongshu.com tab must be open and signed in
  - www.xiaohongshu.com tab must be open (for x-rap-param calculation)
"""

import sys, os, json, base64, argparse
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def load_image_as_base64(path: str) -> tuple:
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


def main():
    parser = argparse.ArgumentParser(description='Test XHS publish_note API')
    parser.add_argument('--image', required=True, help='Path to image file to publish')
    parser.add_argument('--title', default='测试标题', help='Note title')
    parser.add_argument('--desc', default='这是一条测试笔记，可以忽略。', help='Note description')
    parser.add_argument('--private', action='store_true', help='Publish as private (privacy_type=1)')
    parser.add_argument('--privacy', type=int, default=None, help='Privacy type: 0=public, 1=private, 3=specific users, 4=friends')
    parser.add_argument('--privacy-user-ids', default='', help='Comma-separated user IDs for privacy_type=3')
    parser.add_argument('--topics', default='', help='Comma-separated topic names to attach')

    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"Error: Image file not found: {args.image}")
        return 1

    # Determine privacy_type
    if args.privacy is not None:
        privacy_type = args.privacy
    elif args.private:
        privacy_type = 1
    else:
        privacy_type = 0

    privacy_user_ids = [u.strip() for u in args.privacy_user_ids.split(",") if u.strip()] if args.privacy_user_ids else []

    print("=" * 60)
    print("Test: Publish image note")
    print("=" * 60)
    print(f"Image: {args.image}")
    print(f"Title: {args.title}")
    print(f"Desc: {args.desc}")
    print(f"Privacy type: {privacy_type}")
    if privacy_user_ids:
        print(f"Privacy user IDs: {privacy_user_ids}")
    print("=" * 60)

    # Load image
    print("\nLoading image...")
    try:
        b64_data, mime_type = load_image_as_base64(args.image)
        file_size = os.path.getsize(args.image)
        if file_size >= 1024 * 1024:
            size_str = f"{file_size / 1024 / 1024:.1f} MB"
        else:
            size_str = f"{file_size / 1024:.1f} KB"
        print(f"Loaded: {size_str}, mime={mime_type}")
    except Exception as e:
        print(f"Error: Failed to load image: {e}")
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

    print("\nPublishing note...")
    print("(requires creator.xiaohongshu.com tab open and signed in)")

    try:
        result = client.xhs.publish_note(
            title=args.title,
            desc=args.desc,
            images=[{"base64": b64_data, "mimeType": mime_type}],
            privacy_type=privacy_type,
            privacy_user_ids=privacy_user_ids if privacy_user_ids else None,
            topics=topics if topics else None,
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
        print("\nResponse:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    else:
        print(f"\nError: {result.get('error') or result.get('msg', 'Unknown error')}")
        print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return 1


if __name__ == '__main__':
    raise SystemExit(main())