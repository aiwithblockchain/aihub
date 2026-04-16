#!/usr/bin/env python3
"""
Test Publish APIs (Create Tweet, Create Reply) with Multimedia Support
测试场景 5: 发布和回复测试（含多媒体）

支持命令行参数：
  --text TEXT           推文文本内容
  --image PATH          单张图片路径
  --images PATH1,PATH2  多张图片路径（逗号分隔，最多4张）
  --video PATH          视频路径
  --reply-to TWEET_ID   回复推文ID
  --auto                AI自动化测试模式

示例：
  python3 test_publish.py --text "Hello World"
  python3 test_publish.py --text "Check this" --image ~/test.jpg
  python3 test_publish.py --text "Gallery" --images img1.jpg,img2.jpg
  python3 test_publish.py --reply-to 123456 --text "Reply" --image test.jpg
"""
import sys
import argparse
import os
from typing import List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def upload_media_file(client: ClawBotClient, file_path: str) -> Optional[str]:
    """
    基于 clawbot 类库上传媒体文件并获取 media_id

    Args:
        client: 新类库客户端实例
        file_path: 待上传的媒体文件本地路径

    Returns:
        Optional[str]: 返回 media_id；若上传失败或用户取消则返回 None
    """
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return None

    file_size = os.path.getsize(file_path)
    print(f"📤 上传媒体文件: {file_path} ({file_size} bytes)")

    try:
        result = client.media.upload(file_path)
        if result.media_id:
            print(f"✅ 媒体上传成功，media_id: {result.media_id}")
            return result.media_id

        print("❌ 错误: 类库未返回 media_id")
        return None

    except Exception as e:
        print(f"❌ 媒体上传失败: {e}")
        return None


def test_create_tweet(client: ClawBotClient, text: str, media_ids: Optional[List[str]] = None):
    """
    测试推文发布接口

    Args:
        client: clawbot 客户端实例
        text: 推文正文内容
        media_ids: 可选的已上传媒体 ID 列表
    """
    print("\n" + "="*60)
    print("Testing: create tweet via clawbot")
    print("="*60)
    print(f"Text: {text}")
    if media_ids:
        print(f"Media IDs: {media_ids}")

    result = client.x.actions.create_tweet(text=text, media_ids=media_ids)
    raw = result.raw if hasattr(result, "raw") else {}
    print(str(raw)[:500] + "...")

    if result.success:
        if result.target_id:
            print("✅ 推文发布成功")
            print(f"   Tweet ID: {result.target_id}")
            print(f"   请在 X 网页上验证: https://x.com/i/web/status/{result.target_id}")
            return True, result.target_id
        print("⚠️  推文可能已发布，但未找到 rest_id")
        return True, None

    print(f"❌ 推文发布失败: {result.message or '未知错误'}")
    return False, None


def test_create_reply(client: ClawBotClient, tweet_id: str, text: str, media_ids: Optional[List[str]] = None):
    """
    测试回复推文接口

    Args:
        client: clawbot 客户端实例
        tweet_id: 需要回复的目的推文 ID
        text: 回复的正文内容
        media_ids: 可选的已上传媒体 ID 列表
    """
    print("\n" + "="*60)
    print("Testing: create reply via clawbot")
    print("="*60)
    print(f"Reply to: {tweet_id}")
    print(f"Text: {text}")
    if media_ids:
        print(f"Media IDs: {media_ids}")

    result = client.x.actions.reply(tweet_id=tweet_id, text=text, media_ids=media_ids)
    raw = result.raw if hasattr(result, "raw") else {}
    print(str(raw)[:500] + "...")

    if result.success:
        print("✅ 回复发布成功")
        print(f"   请在 X 网页上验证: https://x.com/i/web/status/{tweet_id}")
        return True

    print(f"❌ 回复发布失败: {result.message or '未知错误'}")
    return False


def main():
    parser = argparse.ArgumentParser(
        description='测试推文发布和回复功能（支持多媒体）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 纯文字发布
  python3 test_publish.py --text "Hello World"

  # 文字 + 单图
  python3 test_publish.py --text "Check this" --image ~/test.jpg

  # 文字 + 多图
  python3 test_publish.py --text "Gallery" --images img1.jpg,img2.jpg,img3.jpg

  # 文字 + 视频
  python3 test_publish.py --text "Video" --video ~/test.mp4

  # 回复推文（带图片）
  python3 test_publish.py --reply-to 1234567890 --text "Reply" --image test.jpg

  # AI 自动化测试
  python3 test_publish.py --auto
        """
    )

    parser.add_argument('--text', type=str, help='推文文本内容')
    parser.add_argument('--image', type=str, help='单张图片路径')
    parser.add_argument('--images', type=str, help='多张图片路径（逗号分隔，最多4张）')
    parser.add_argument('--video', type=str, help='视频路径')
    parser.add_argument('--reply-to', type=str, help='回复推文ID')
    parser.add_argument('--auto', action='store_true', help='AI自动化测试模式')

    args = parser.parse_args()

    # AI 自动化测试模式
    if args.auto:
        print("\n🤖 AI 自动化测试模式")
        print("="*60)
        print("⚠️  此模式将发布真实推文到您的账号！")
        confirm = input("继续? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("⏭️  已取消")
            sys.exit(0)

        # 使用时间戳作为测试文本
        from datetime import datetime
        test_text = f"AI 自动化测试 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        success, tweet_id = test_create_tweet(ClawBotClient(), test_text)

        if success:
            print("\n✅ AI 自动化测试完成")
            sys.exit(0)
        else:
            print("\n❌ AI 自动化测试失败")
            sys.exit(1)

    # 检查必需参数
    if not args.text:
        print("❌ 错误: 必须提供 --text 参数")
        parser.print_help()
        sys.exit(1)

    # 处理媒体文件
    media_ids = []
    client = ClawBotClient()
    media_client = client

    # 处理单张图片
    if args.image:
        media_id = upload_media_file(media_client, args.image)
        if media_id:
            media_ids.append(media_id)
        else:
            print("\n❌ 任务失败: 无法上传图片")
            sys.exit(1)

    # 处理多张图片
    if args.images:
        image_paths = [p.strip() for p in args.images.split(',')]
        if len(image_paths) > 4:
            print("❌ 错误: 最多支持 4 张图片")
            sys.exit(1)

        for image_path in image_paths:
            media_id = upload_media_file(media_client, image_path)
            if media_id:
                media_ids.append(media_id)
            else:
                print(f"\n❌ 任务失败: 无法上传图片 {image_path}")
                sys.exit(1)

    # 处理视频
    if args.video:
        media_id = upload_media_file(media_client, args.video)
        if media_id:
            media_ids.append(media_id)
        else:
            print("\n❌ 任务失败: 无法上传视频")
            sys.exit(1)

    # 人工确认
    print("\n⚠️  警告: 此操作将在您的 X 账号上发布真实内容！")
    print(f"   文本: {args.text}")
    if media_ids:
        print(f"   媒体: {len(media_ids)} 个文件")
    if args.reply_to:
        print(f"   回复: {args.reply_to}")

    confirm = input("\n确认发布? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  已取消")
        sys.exit(0)

    # 执行发布或回复
    if args.reply_to:
        success = test_create_reply(client, args.reply_to, args.text, media_ids if media_ids else None)
    else:
        success, _ = test_create_tweet(client, args.text, media_ids if media_ids else None)

    if success:
        print("\n✅ 测试完成")
        sys.exit(0)
    else:
        print("\n❌ 测试失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
