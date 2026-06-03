"""Example: publish a large video note to XHS via task channel.

Usage:
    python xhs_publish_video_large.py /path/to/video.mp4 "标题" "描述"

This bypasses the Chrome 64 MiB message limit by using chunked task upload.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 4:
        print("Usage: python xhs_publish_video_large.py <video_path> <title> <desc> [cover_path]")
        print("Example: python xhs_publish_video_large.py ./test.mp4 '我的视频' '视频描述' ./cover.jpg")
        sys.exit(1)

    video_path = sys.argv[1]
    title = sys.argv[2]
    desc = sys.argv[3]
    cover_path = sys.argv[4] if len(sys.argv) > 4 else None

    print(f"Video path: {video_path}")
    print(f"Title: {title}")
    print(f"Desc: {desc}")
    print(f"Cover: {cover_path or '(auto)'}")

    client = ClawBotClient()

    print("\nStarting large video upload via task channel...")
    print("This will chunk the video and upload through LocalBridge -> tweetClaw extension")

    try:
        result = client.xhs.publish_video_note_large(
            file_path=video_path,
            title=title,
            desc=desc,
            cover_path=cover_path,
            privacy_type=0,  # 0=public
            instance_id="default",  # 显式指定，避免读取配置
        )
        print("\n✅ Publish succeeded!")
        print(f"Note ID: {result.get('data', {}).get('id', 'N/A')}")
        print(f"Result: {result}")
    except Exception as e:
        print(f"\n❌ Publish failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()