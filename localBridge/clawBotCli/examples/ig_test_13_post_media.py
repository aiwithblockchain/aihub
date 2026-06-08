#!/usr/bin/env python3
"""
Instagram API 测试：发布媒体（图片）

测试场景：
1. 上传图片
2. 配置媒体（发布）
3. 验证发布成功

使用方法：
  python3 ig_test_13_post_media.py <image_path> <caption>

示例：
  python3 examples/ig_test_13_post_media.py /path/to/image.jpg "Test post from TweetPilot"
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

    image_path = sys.argv[1]
    caption = sys.argv[2]

    print(f"\n{'='*60}")
    print(f"测试：发布媒体")
    print(f"{'='*60}")
    print(f"Image Path:     {image_path}")
    print(f"Caption:        {caption}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 发布媒体
        print(f"📸 步骤 1: 发布媒体...")
        start_time = time.time()
        result = client.ig.post_media(
            image_path=image_path,
            caption=caption,
            disable_comments=False,
            share_to_threads=True,
        )
        elapsed_time = time.time() - start_time

        media = result.get('media', {})
        media_id = media.get('id')
        media_pk = media.get('pk')
        media_code = media.get('code')

        if not media_id:
            print(f"❌ 发布失败：未返回媒体 ID")
            print(f"   响应数据: {result}")
            sys.exit(1)

        print(f"✅ 媒体已发布")
        print(f"   媒体 ID:     {media_id}")
        print(f"   媒体 PK:     {media_pk}")
        print(f"   短代码:      {media_code}")
        print(f"   文案:        {media.get('caption', caption)}")
        print(f"   媒体类型:    {media.get('mediaType', 1)}")
        print(f"   发布时间:    {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(media.get('takenAt', 0)))}")
        print(f"   响应时间:    {elapsed_time:.2f}s")
        print()

        # 验证发布成功
        print(f"🔍 步骤 2: 验证发布成功...")
        print(f"   Instagram URL: https://www.instagram.com/p/{media_code}/")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！媒体发布成功")
        print(f"{'='*60}\n")

    except FileNotFoundError as e:
        print(f"\n❌ 图片文件不存在: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()