#!/usr/bin/env python3
"""
Instagram API 测试：获取用户媒体列表

使用方法：
  python3 ig_test_15_get_user_media.py <username_or_user_id> [count]

示例：
  python3 examples/ig_test_15_get_user_media.py tweetpilot_ai
  python3 examples/ig_test_15_get_user_media.py 27233003055 24
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    user_identifier = sys.argv[1]
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 12

    print(f"\n{'='*60}")
    print(f"测试：获取用户媒体列表")
    print(f"{'='*60}")
    print(f"User:           {user_identifier}")
    print(f"Count:          {count}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 判断是用户名还是用户 ID
        if user_identifier.isdigit():
            # 数字，当作用户 ID
            print(f"🔍 使用用户 ID 查询...")
            result = client.ig.get_user_media(user_id=user_identifier, count=count)
        else:
            # 字符串，当作用户名
            print(f"🔍 使用用户名查询...")
            result = client.ig.get_user_media(username=user_identifier, count=count)

        # 打印完整响应（调试用）
        print(f"\n📋 完整响应数据:")
        print(f"   success: {result.get('success')}")
        print(f"   items 类型: {type(result.get('items'))}")
        print(f"   items 长度: {len(result.get('items', []))}")
        print(f"   pageInfo: {result.get('pageInfo')}")
        if result.get('items'):
            print(f"   第一个 item: {result.get('items')[0] if result.get('items') else 'None'}")
        print()

        items = result.get('items', [])
        page_info = result.get('pageInfo', {})

        if not items:
            print(f"❌ 未找到媒体")
            sys.exit(1)

        print(f"✅ 获取成功")
        print(f"   媒体数量:    {len(items)}")
        print(f"   是否有下一页: {page_info.get('hasNextPage', False)}")
        if page_info.get('endCursor'):
            print(f"   下一页游标:  {page_info.get('endCursor')[:50]}...")
        print()

        # 显示媒体列表
        print(f"{'='*60}")
        print(f"媒体列表:")
        print(f"{'='*60}")

        for i, item in enumerate(items[:10], 1):  # 只显示前 10 个
            print(f"\n{i}. {item.get('code', 'N/A')}")
            print(f"   媒体 ID:     {item.get('pk', 'N/A')}")
            print(f"   媒体类型:    {item.get('mediaType', 'N/A')} (1=图片, 2=视频, 8=轮播)")
            print(f"   文案:        {(item.get('caption') or '无文案')[:50]}...")
            print(f"   点赞数:      {item.get('likeCount', 0)}")
            print(f"   评论数:      {item.get('commentCount', 0)}")
            print(f"   发布时间:    {item.get('takenAt', 'N/A')}")
            print(f"   Instagram:   https://www.instagram.com/p/{item.get('code', 'N/A')}/")

        if len(items) > 10:
            print(f"\n... 还有 {len(items) - 10} 个媒体")

        print()
        print(f"{'='*60}")
        print(f"✅ 测试通过！获取用户媒体成功")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()