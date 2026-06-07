#!/usr/bin/env python3
"""
Instagram API 测试：获取媒体评论列表

测试场景：
1. 获取指定媒体的评论列表
2. 测试分页功能
3. 测试排序选项

使用方法：
  python3 ig_test_11_get_media_comments.py <media_id> [min_id] [sort_order]

示例：
  # 获取热门评论
  python3 ig_test_11_get_media_comments.py 3913384059204773903

  # 获取时间顺序评论
  python3 ig_test_11_get_media_comments.py 3913384059204773903 "" chronological

  # 使用分页游标获取下一页
  python3 ig_test_11_get_media_comments.py 3913384059204773903 '{"cached_comments_cursor":"18131997424603945","bifilter_token":"xxx"}'
"""

import sys
import os
import json
import time

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from clawbot.transport.ig_api import IgApiTransport


def format_timestamp(timestamp: int) -> str:
    """格式化 Unix 时间戳"""
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    media_id = sys.argv[1]
    min_id = sys.argv[2] if len(sys.argv) > 2 else None
    sort_order = sys.argv[3] if len(sys.argv) > 3 else 'popular'

    print(f"\n{'='*60}")
    print(f"测试：获取媒体评论列表")
    print(f"{'='*60}")
    print(f"Media ID:       {media_id}")
    print(f"Min ID:         {min_id or '(首次加载)'}")
    print(f"Sort Order:     {sort_order}")
    print(f"{'='*60}\n")

    # 创建 Transport
    transport = IgApiTransport()

    try:
        # 调用 API
        start_time = time.time()
        result = transport.get_media_comments(
            media_id=media_id,
            min_id=min_id,
            sort_order=sort_order
        )
        elapsed_time = time.time() - start_time

        # 检查结果
        if not result.get('success'):
            print(f"❌ API 调用失败")
            print(f"Error: {result.get('error')}")
            sys.exit(1)

        data = result.get('data', {})

        # 显示帖子文案
        caption = data.get('caption')
        if caption:
            print(f"📝 帖子文案:")
            print(f"   {caption.get('text', '(无文案)')}")
            print(f"   作者: @{caption.get('user', {}).get('username', 'unknown')}")
            print()

        # 显示统计信息
        comment_count = data.get('commentCount', 0)
        comments = data.get('comments', [])
        print(f"📊 评论统计:")
        print(f"   总评论数:     {comment_count}")
        print(f"   本次返回:     {len(comments)} 条")
        print(f"   响应时间:     {elapsed_time:.2f}s")
        print()

        # 显示评论列表
        if comments:
            print(f"💬 评论列表:")
            print(f"{'─'*60}")
            for i, comment in enumerate(comments, 1):
                username = comment.get('username', 'unknown')
                text = comment.get('text', '')
                like_count = comment.get('likeCount', 0)
                has_liked = comment.get('hasLiked', False)
                created_at = comment.get('createdAt', 0)
                child_count = comment.get('childCommentCount', 0)

                print(f"\n[{i}] @{username}")
                print(f"    {text}")
                print(f"    ❤️ {like_count} likes", end='')
                if has_liked:
                    print(f" (已点赞)", end='')
                if child_count > 0:
                    print(f" | 💬 {child_count} replies", end='')
                print()
                if created_at:
                    print(f"    🕒 {format_timestamp(created_at)}", end='')
                print()
        else:
            print("⚠️  没有评论")

        # 显示分页信息
        next_min_id = data.get('nextMinId')
        can_view_more = data.get('canViewMore', False)

        print(f"\n{'='*60}")
        print(f"📄 分页信息:")
        print(f"   Can View More: {can_view_more}")
        if next_min_id:
            print(f"   Next Min ID:   {next_min_id[:100]}...")
            print(f"\n💡 获取下一页:")
            print(f"   python3 ig_test_11_get_media_comments.py {media_id} '{next_min_id}' {sort_order}")
        print(f"{'='*60}\n")

        print(f"✅ 测试通过！\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()