#!/usr/bin/env python3
"""
Instagram API 测试：删除评论

测试场景：
1. 发布一条测试评论
2. 获取评论列表，找到测试评论
3. 删除测试评论
4. 验证删除成功

使用方法：
  python3 ig_test_12_delete_comment.py <media_id> <comment_text>

示例：
  python3 examples/ig_test_12_delete_comment.py 3913384059204773903 "Test comment for deletion"
"""

import sys
import os
import time

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def format_timestamp(timestamp: int) -> str:
    """格式化 Unix 时间戳"""
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    media_id = sys.argv[1]
    comment_text = sys.argv[2]

    print(f"\n{'='*60}")
    print(f"测试：删除评论")
    print(f"{'='*60}")
    print(f"Media ID:       {media_id}")
    print(f"Comment Text:   {comment_text}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 步骤 1: 发布测试评论
        print(f"📝 步骤 1: 发布测试评论...")
        start_time = time.time()
        result = client.ig.post_comment(
            media_id=media_id,
            text=comment_text
        )
        elapsed_time = time.time() - start_time

        # 响应格式: {"success": true, "comment": {"id": "xxx", "text": "xxx", ...}}
        comment_data = result.get('comment', {})
        comment_id = comment_data.get('id')
        if not comment_id:
            print(f"❌ 发布评论失败：未返回评论 ID")
            print(f"   响应数据: {result}")
            sys.exit(1)

        print(f"✅ 评论已发布")
        print(f"   评论 ID:     {comment_id}")
        print(f"   评论内容:    {comment_data.get('text', comment_text)}")
        print(f"   响应时间:    {elapsed_time:.2f}s")
        print()

        # 等待评论生效
        print(f"⏳ 等待 2 秒让评论生效...")
        time.sleep(2)
        print()

        # 步骤 2: 获取评论列表，验证评论存在
        print(f"📋 步骤 2: 获取评论列表，验证评论存在...")
        result = client.ig.get_media_comments(
            media_id=media_id,
            sort_order='chronological'  # 使用时间顺序，更容易找到新评论
        )

        comments = result.get('comments', [])
        found_comment = None

        for comment in comments:
            if comment.get('id') == comment_id:
                found_comment = comment
                break

        if found_comment:
            print(f"✅ 找到测试评论")
            print(f"   用户名:      @{found_comment.get('username', 'unknown')}")
            print(f"   内容:        {found_comment.get('text', '')}")
            print(f"   点赞数:      {found_comment.get('likeCount', 0)}")
        else:
            print(f"⚠️  未在评论列表中找到测试评论（可能需要更多时间生效）")

        print()

        # 步骤 3: 删除评论
        print(f"🗑️  步骤 3: 删除评论...")
        start_time = time.time()
        result = client.ig.delete_comment(
            media_id=media_id,
            comment_id=comment_id
        )
        elapsed_time = time.time() - start_time

        status = result.get('status')
        if status == 'ok':
            print(f"✅ 评论已删除")
            print(f"   状态:        {status}")
            print(f"   响应时间:    {elapsed_time:.2f}s")
        else:
            print(f"❌ 删除失败：{result}")
            sys.exit(1)

        print()

        # 步骤 4: 验证删除成功
        print(f"🔍 步骤 4: 验证删除成功...")
        print(f"⏳ 等待 2 秒让删除生效...")
        time.sleep(2)

        result = client.ig.get_media_comments(
            media_id=media_id,
            sort_order='chronological'
        )

        comments = result.get('comments', [])
        found_comment = None

        for comment in comments:
            if comment.get('id') == comment_id:
                found_comment = comment
                break

        if found_comment:
            print(f"❌ 评论仍然存在，删除可能失败")
            print(f"   评论 ID:     {comment_id}")
            sys.exit(1)
        else:
            print(f"✅ 评论已成功删除，验证通过")

        print(f"\n{'='*60}")
        print(f"✅ 测试通过！所有步骤完成")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()