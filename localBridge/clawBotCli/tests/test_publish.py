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
import json
import argparse
import os
from typing import List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.api_client import APIClient


def upload_media_file(client: APIClient, file_path: str) -> Optional[str]:
    """
    上传媒体文件并返回 media_id

    注意：此功能需要后端支持 media upload API
    如果后端未实现，将返回 None 并提示错误
    """
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return None

    file_size = os.path.getsize(file_path)
    print(f"📤 上传媒体文件: {file_path} ({file_size} bytes)")

    try:
        # 尝试调用 upload_media API
        if hasattr(client, 'upload_media'):
            media_id = client.upload_media(file_path)
            if media_id:
                print(f"✅ 媒体上传成功，media_id: {media_id}")
                return media_id

        # 如果没有 upload_media 方法，返回错误
        print("❌ 错误: API 客户端不支持 upload_media 方法")
        print("   后端需要实现 Twitter media upload API")
        return None

    except Exception as e:
        print(f"❌ 媒体上传失败: {e}")
        return None


def explain_media_upload_failure(file_path: str):
    file_size = os.path.getsize(file_path)
    print(f"   文件大小: {file_size} bytes")
    print("   原因: 请查看上面的直接错误信息")
    if file_size > 64 * 1024 * 1024:
        print("   推断: 当前失败发生在 Chrome 扩展消息通道，单条消息超过 64MiB 上限")
        print("   建议: 不要一次性把整段视频 base64 通过 tabs.sendMessage 发送给 content script")
        print("   建议: 改为分块传输、共享存储中转，或在页面上下文直接处理文件")
    else:
        print("   建议: 根据上面的错误信息继续排查上传流程")


def test_create_tweet(text: str, media_ids: Optional[List[str]] = None):
    """Test POST /api/v1/x/tweets"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/x/tweets")
    print("="*60)
    print(f"Text: {text}")
    if media_ids:
        print(f"Media IDs: {media_ids}")

    client = APIClient()

    # 检查 create_tweet 是否支持 media_ids 参数
    try:
        response = client.create_tweet(text, media_ids=media_ids)
    except TypeError:
        # 如果不支持 media_ids 参数，尝试不带参数调用
        if media_ids:
            print("⚠️  警告: create_tweet 不支持 media_ids 参数，仅发布文字")
        response = client.create_tweet(text)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    # Validate response
    # 支持两种响应格式：
    # 1. {"ok": true, "data": {"data": {"create_tweet": {...}}}}
    # 2. {"data": {"create_tweet": {...}}}
    data = response.get('data', {})
    if isinstance(data, dict) and 'data' in data:
        # 格式 1: 嵌套的 data
        data = data['data']

    if 'create_tweet' in data:
        tweet_results = data['create_tweet'].get('tweet_results', {})
        result = tweet_results.get('result', {})
        tweet_id = result.get('rest_id')

        if tweet_id:
            print(f"✅ 推文发布成功")
            print(f"   Tweet ID: {tweet_id}")
            print(f"   请在 X 网页上验证: https://x.com/i/web/status/{tweet_id}")
            return True, tweet_id
        else:
            print("⚠️  推文可能已发布，但未找到 rest_id")
            return True, None
    elif 'error' in response:
        print(f"❌ 推文发布失败: {response['error']}")
        return False, None
    else:
        print("❌ 推文发布失败: 未知响应格式")
        return False, None


def test_create_reply(tweet_id: str, text: str, media_ids: Optional[List[str]] = None):
    """Test POST /api/v1/x/replies"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/x/replies")
    print("="*60)
    print(f"Reply to: {tweet_id}")
    print(f"Text: {text}")
    if media_ids:
        print(f"Media IDs: {media_ids}")

    client = APIClient()

    # 检查 create_reply 是否支持 media_ids 参数
    try:
        response = client.create_reply(tweet_id, text, media_ids=media_ids)
    except TypeError:
        # 如果不支持 media_ids 参数，尝试不带参数调用
        if media_ids:
            print("⚠️  警告: create_reply 不支持 media_ids 参数，仅发布文字")
        response = client.create_reply(tweet_id, text)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:500] + "...")

    # Validate response
    if 'data' in response or 'ok' in response:
        print(f"✅ 回复发布成功")
        print(f"   请在 X 网页上验证: https://x.com/i/web/status/{tweet_id}")
        return True
    elif 'error' in response:
        print(f"❌ 回复发布失败: {response['error']}")
        return False
    else:
        print("❌ 回复发布失败: 未知响应格式")
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
        success, tweet_id = test_create_tweet(test_text)

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
    client = APIClient()

    # 处理单张图片
    if args.image:
        media_id = upload_media_file(client, args.image)
        if media_id:
            media_ids.append(media_id)
        else:
            print("\n❌ 任务失败: 无法上传图片")
            explain_media_upload_failure(args.image)
            sys.exit(1)

    # 处理多张图片
    if args.images:
        image_paths = [p.strip() for p in args.images.split(',')]
        if len(image_paths) > 4:
            print("❌ 错误: 最多支持 4 张图片")
            sys.exit(1)

        for image_path in image_paths:
            media_id = upload_media_file(client, image_path)
            if media_id:
                media_ids.append(media_id)
            else:
                print(f"\n❌ 任务失败: 无法上传图片 {image_path}")
                explain_media_upload_failure(image_path)
                sys.exit(1)

    # 处理视频
    if args.video:
        media_id = upload_media_file(client, args.video)
        if media_id:
            media_ids.append(media_id)
        else:
            print("\n❌ 任务失败: 无法上传视频")
            explain_media_upload_failure(args.video)
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
        success = test_create_reply(args.reply_to, args.text, media_ids if media_ids else None)
    else:
        success, _ = test_create_tweet(args.text, media_ids if media_ids else None)

    if success:
        print("\n✅ 测试完成")
        sys.exit(0)
    else:
        print("\n❌ 测试失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
