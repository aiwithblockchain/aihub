#!/usr/bin/env python3
"""
Instagram API 测试：发布视频

使用方法：
  python3 ig_test_16_post_video.py <video_path> <caption>

示例：
  python3 examples/ig_test_16_post_video.py test_media/a.mp4 "Test video from TweetPilot API - $(date +%s)"
"""

import sys
import os
import time

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    video_path = sys.argv[1]
    caption = sys.argv[2]

    print(f"\n{'='*60}")
    print(f"测试：发布视频")
    print(f"{'='*60}")
    print(f"Video Path:     {video_path}")
    print(f"Caption:        {caption}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 发布视频
        print(f"🎬 步骤 1: 发布视频...")
        start_time = time.time()
        result = client.ig.post_video(
            video_path=video_path,
            caption=caption,
            share_to_threads=True,
        )
        elapsed_time = time.time() - start_time

        media = result.get('media', {})
        media_id = media.get('id')
        media_pk = media.get('pk')
        code = media.get('code')
        taken_at = media.get('taken_at')

        if not media_pk:
            print(f"❌ 发布失败：未返回媒体 ID")
            print(f"   响应数据: {result}")
            sys.exit(1)

        print(f"✅ 视频已发布")
        print(f"   媒体 ID:     {media_id}")
        print(f"   媒体 PK:     {media_pk}")
        print(f"   短代码:      {code}")
        print(f"   文案:        {caption}")
        print(f"   发布时间:    {taken_at}")
        print(f"   响应时间:    {elapsed_time:.2f}s")
        print()

        # 验证发布成功
        print(f"🔍 步骤 2: 验证发布成功...")
        print(f"   Instagram URL: https://www.instagram.com/reel/{code}/")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！视频发布成功")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()