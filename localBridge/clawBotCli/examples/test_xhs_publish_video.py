#!/usr/bin/env python3
"""
Test XHS publish_video_note API.

Usage:
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --title "标题" --desc "描述"
    python3 examples/test_xhs_publish_video.py --video path/to/video.mp4 --private

Notes:
    - creator.xiaohongshu.com tab must be open and signed in
    - www.xiaohongshu.com tab must be open (for x-rap-param calculation)
    - video_info is a placeholder dict; once you capture a real publish request,
      replace VIDEO_INFO_TEMPLATE with the actual structure.
"""

import sys
import os
import json
import base64
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


# ── video_info 模板 ────────────────────────────────────────────────────────────
# 这是从抓包中待补全的字段结构。
# 当前为最小占位符，COS 上传完成后 video.file_id 会被 tweetClaw 自动覆盖。
# 发布成功后请更新此模板为真实结构（含 cover、duration、width、height 等）。
VIDEO_INFO_TEMPLATE: dict = {
    "video": {
        "file_id": "",          # tweetClaw 会用本次上传的 fileId 覆盖
    },
    # TODO: 抓包后补充以下字段
    # "cover": { "file_id": "spectrum/xxx" },
    # "duration": 12345,       # 视频时长（毫秒）
    # "width": 1080,
    # "height": 1920,
}


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
    parser.add_argument("--title", default="测试视频标题", help="Note title (default: 测试视频标题)")
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
    print("   (requires creator.xiaohongshu.com and www.xiaohongshu.com tabs open)")
    print("   (large videos will take a while to upload via COS multipart)")

    try:
        result = client.xhs.publish_video_note(
            title=args.title,
            desc=args.desc,
            video={"base64": b64_data, "mimeType": mime_type},
            video_info=VIDEO_INFO_TEMPLATE,
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
