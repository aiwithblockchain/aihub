#!/usr/bin/env python3
"""
Publish and media smoke test for clawBotCli.

Designed for one publish action at a time with clearer media handling.
Examples:
  python3 tests/test_publish.py --text "hello" --yes
  python3 tests/test_publish.py --text "reply" --reply-to 123 --yes
  python3 tests/test_publish.py --text "media" --image tests_media.jpg --yes
"""
import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

TEST_MEDIA_DIR = Path(__file__).resolve().parent.parent / "test_media"
DEFAULT_PLAIN_TEXT = "[ClawBot test] Read/write regression check for LocalBridge + clawBotCli. Safe to ignore."
DEFAULT_REPLY_TEXT = "[ClawBot test reply] Verifying canonical tweet detail / replies flow."
DEFAULT_MEDIA_TEXT = "[ClawBot media test] Verifying media upload path from clawBotCli tests."


def with_timestamp(text: str) -> str:
    return f"{text} ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"


def resolve_media_path(path_text: str) -> str:
    path = Path(path_text).expanduser()
    if path.exists():
        return str(path)
    candidate = TEST_MEDIA_DIR / path_text
    if candidate.exists():
        return str(candidate)
    raise FileNotFoundError(f"Media file not found: {path_text}")


def gather_media_paths(args: argparse.Namespace) -> List[str]:
    paths: List[str] = []
    if args.image:
        paths.append(resolve_media_path(args.image))
    if args.images:
        raw_items = [item.strip() for item in args.images.split(",") if item.strip()]
        if len(raw_items) > 4:
            raise ValueError("At most 4 images are supported")
        paths.extend(resolve_media_path(item) for item in raw_items)
    if args.video:
        paths.append(resolve_media_path(args.video))
    return paths


def confirm_or_exit(message: str, assume_yes: bool) -> None:
    print(message)
    if assume_yes:
        return
    confirm = input("Confirm publish? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Skipped")
        raise SystemExit(0)


def resolve_instance_id(client: ClawBotClient, preferred_instance_id: Optional[str] = None) -> Optional[str]:
    if preferred_instance_id:
        return preferred_instance_id

    instances_payload: Any = client.x.status.get_instances()
    if isinstance(instances_payload, dict):
        instances = instances_payload.get("instances") or []
    elif isinstance(instances_payload, list):
        instances = instances_payload
    else:
        instances = []

    if not instances:
        return None

    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")
    return str(instance_id) if instance_id else None


def upload_media(client: ClawBotClient, file_paths: List[str], instance_id: Optional[str], tab_id: Optional[int]) -> List[str]:
    media_ids: List[str] = []
    for file_path in file_paths:
        print(f"📤 Uploading media file: {file_path}")
        result = client.media.upload(file_path, instance_id=instance_id, tab_id=tab_id)
        print(f"✅ Uploaded media_id: {result.media_id}")
        media_ids.append(result.media_id)
    return media_ids


def create_tweet(client: ClawBotClient, text: str, media_ids: Optional[List[str]] = None, instance_id: Optional[str] = None):
    result = client.x.actions.create_tweet(text=text, media_ids=media_ids, instance_id=instance_id)
    raw = result.raw if hasattr(result, "raw") else {}
    print(str(raw)[:800] + "...")
    if result.success:
        print("✅ Tweet created successfully")
        print(f"Created tweet ID: {result.target_id or 'unknown'}")
        return True
    print(f"❌ Tweet creation failed: {result.message or 'unknown error'}")
    return False


def create_reply(client: ClawBotClient, tweet_id: str, text: str, media_ids: Optional[List[str]] = None, instance_id: Optional[str] = None):
    result = client.x.actions.reply(tweet_id=tweet_id, text=text, media_ids=media_ids, instance_id=instance_id)
    raw = result.raw if hasattr(result, "raw") else {}
    print(str(raw)[:800] + "...")
    if result.success:
        print("✅ Reply created successfully")
        print(f"Reply target tweet ID: {tweet_id}")
        return True
    print(f"❌ Reply creation failed: {result.message or 'unknown error'}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one publish or media-assisted publish test")
    parser.add_argument("--text", type=str, help="Tweet text")
    parser.add_argument("--image", type=str, help="Single image path, absolute or relative to test_media")
    parser.add_argument("--images", type=str, help="Comma-separated image paths, absolute or relative to test_media")
    parser.add_argument("--video", type=str, help="Video path, absolute or relative to test_media")
    parser.add_argument("--reply-to", type=str, help="Reply target tweet ID")
    parser.add_argument("--instance-id", type=str, help="Explicit instanceId for multi-instance routing")
    parser.add_argument("--tab-id", type=int, help="Optional tabId for media upload")
    parser.add_argument("--yes", action="store_true", help="Skip interactive confirmation")
    args = parser.parse_args()

    media_paths = gather_media_paths(args)
    if args.reply_to:
        text = args.text or with_timestamp(DEFAULT_REPLY_TEXT)
    elif media_paths:
        text = args.text or with_timestamp(DEFAULT_MEDIA_TEXT)
    else:
        text = args.text or with_timestamp(DEFAULT_PLAIN_TEXT)

    print("\n🧪 Testing Publish APIs")
    print("=" * 60)
    print("⚠️  WARNING: This will publish real content on your X account")
    print("=" * 60)
    print(f"Text: {text}")
    if args.reply_to:
        print(f"Reply target: {args.reply_to}")
    if media_paths:
        print(f"Media files: {media_paths}")

    confirm_or_exit("⚠️  Real publish action will be executed.", args.yes)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")
    media_ids = upload_media(client, media_paths, instance_id, args.tab_id) if media_paths else None

    if args.reply_to:
        success = create_reply(client, args.reply_to, text, media_ids, instance_id=instance_id)
    else:
        success = create_tweet(client, text, media_ids, instance_id=instance_id)

    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    print(f"{'✅ PASS' if success else '❌ FAIL'} - publish")
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
