#!/usr/bin/env python3
"""
Live media upload smoke test for clawBotCli.

This is a focused upload-only script. It does not publish a tweet.
Use test_publish.py when you want upload + publish together.
Examples:
  python3 tests/test_media_upload.py --image sample.jpg --yes
  python3 tests/test_media_upload.py --video clip.mp4 --instance-id xxx --yes
"""
import argparse
import os
import sys
from pathlib import Path
from typing import Any, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

TEST_MEDIA_DIR = Path(__file__).resolve().parent.parent / "test_media"


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
    if not paths:
        raise ValueError("At least one of --image, --images, or --video is required")
    return paths


def confirm_or_exit(message: str, assume_yes: bool) -> None:
    print(message)
    if assume_yes:
        return
    confirm = input("Confirm upload? (yes/no): ").strip().lower()
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Run media upload smoke tests without publishing")
    parser.add_argument("--image", type=str, help="Single image path, absolute or relative to test_media")
    parser.add_argument("--images", type=str, help="Comma-separated image paths, absolute or relative to test_media")
    parser.add_argument("--video", type=str, help="Video path, absolute or relative to test_media")
    parser.add_argument("--instance-id", type=str, help="Explicit instanceId for upload")
    parser.add_argument("--tab-id", type=int, help="Optional tabId for upload")
    parser.add_argument("--yes", action="store_true", help="Skip interactive confirmation")
    args = parser.parse_args()

    media_paths = gather_media_paths(args)

    print("\n🧪 Testing Media Upload")
    print("=" * 60)
    print("⚠️  WARNING: This uploads real media into the X workflow")
    print("=" * 60)
    print(f"Media files: {media_paths}")
    if args.tab_id is not None:
        print(f"Tab ID: {args.tab_id}")

    confirm_or_exit("⚠️  Real media upload task will be executed.", args.yes)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client, preferred_instance_id=args.instance_id)
    print(f"Resolved instance_id: {instance_id}")
    uploaded_ids: List[str] = []

    for media_path in media_paths:
        print(f"\n📤 Uploading: {media_path}")
        result = client.media.upload(media_path, instance_id=instance_id, tab_id=args.tab_id)
        print(f"✅ Uploaded media_id: {result.media_id}")
        uploaded_ids.append(result.media_id)

    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    print(f"✅ PASS - uploaded {len(uploaded_ids)} media file(s)")
    print(f"Media IDs: {uploaded_ids}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
