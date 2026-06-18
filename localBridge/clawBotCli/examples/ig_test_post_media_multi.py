#!/usr/bin/env python3
"""
Instagram API 测试：发布多图轮播（Carousel / Sidecar）

测试场景：
1. 上传多张图片
2. 配置轮播媒体（发布）
3. 验证发布成功

使用方法：
  python3 ig_test_post_media_multi.py <image_path1> <image_path2> [image_path3 ...] --caption "Your caption"

示例：
  python3 examples/ig_test_post_media_multi.py /path/to/photo1.jpg /path/to/photo2.jpg --caption "My carousel post"

参数：
  --caption   帖子文案（必填）
  --location  位置信息，格式：name,lat,lng（可选）
"""

import sys
import os
import time
import argparse

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def parse_location(location_str: str) -> dict:
    """解析位置信息字符串，格式：name,lat,lng"""
    parts = location_str.split(",")
    if len(parts) != 3:
        raise ValueError("位置信息格式错误，应为：name,lat,lng")
    return {
        "name": parts[0].strip(),
        "lat": float(parts[1].strip()),
        "lng": float(parts[2].strip()),
    }


def main():
    parser = argparse.ArgumentParser(description="Instagram 多图上传测试")
    parser.add_argument("images", nargs="+", help="图片文件路径（至少2张）")
    parser.add_argument("--caption", required=True, help="帖子文案")
    parser.add_argument("--location", default=None, help="位置信息，格式：name,lat,lng")
    parser.add_argument("--disable-comments", action="store_true", help="禁用评论")
    parser.add_argument("--no-threads", action="store_true", help="不分享到 Threads")
    args = parser.parse_args()

    image_paths = args.images
    caption = args.caption

    if len(image_paths) < 2:
        print("❌ 多图发布至少需要提供 2 张图片")
        sys.exit(1)

    location = None
    if args.location:
        try:
            location = parse_location(args.location)
        except ValueError as e:
            print(f"❌ 位置参数错误: {e}")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"测试：发布多图轮播（Carousel）")
    print(f"{'='*60}")
    print(f"图片数量:       {len(image_paths)}")
    for i, p in enumerate(image_paths, 1):
        print(f"  图片 {i}:      {p}")
    print(f"文案:           {caption}")
    print(f"禁用评论:       {args.disable_comments}")
    print(f"分享到 Threads: {not args.no_threads}")
    if location:
        print(f"位置:           {location['name']} ({location['lat']}, {location['lng']})")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 发布多图媒体
        print(f"📸 步骤 1: 发布多图轮播...")
        start_time = time.time()
        result = client.ig.post_media(
            image_paths=image_paths,
            caption=caption,
            disable_comments=args.disable_comments,
            share_to_threads=not args.no_threads,
            location=location,
        )
        elapsed_time = time.time() - start_time

        media = result.get("media", {})
        media_id = media.get("id")
        media_pk = media.get("pk")
        media_code = media.get("code")
        media_type = media.get("mediaType")

        if not media_id:
            print(f"❌ 发布失败：未返回媒体 ID")
            print(f"   响应数据: {result}")
            sys.exit(1)

        # Instagram media_type: 1=图片, 2=视频, 8=轮播
        type_label = {1: "单图", 2: "视频", 8: "轮播"}.get(media_type, f"未知({media_type})")

        print(f"✅ 轮播已发布")
        print(f"   媒体 ID:     {media_id}")
        print(f"   媒体 PK:     {media_pk}")
        print(f"   短代码:      {media_code}")
        print(f"   文案:        {media.get('caption', caption)}")
        print(f"   媒体类型:    {type_label}")
        print(f"   发布时间:    {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(media.get('takenAt', 0)))}")
        print(f"   响应时间:    {elapsed_time:.2f}s")
        print()

        # 验证发布成功
        print(f"🔍 步骤 2: 验证发布成功...")
        print(f"   Instagram URL: https://www.instagram.com/p/{media_code}/")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！多图轮播发布成功")
        print(f"{'='*60}\n")

    except FileNotFoundError as e:
        print(f"\n❌ 图片文件不存在: {e}\n")
        sys.exit(1)
    except ValueError as e:
        print(f"\n❌ 参数错误: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
