#!/usr/bin/env python3
"""
Instagram API 调试脚本 - 检查 CSRF token
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient

def main():
    print(f"\n{'='*60}")
    print(f"Instagram CSRF Token 调试")
    print(f"{'='*60}\n")

    client = ClawBotClient()

    # 测试一个简单的 GET 请求
    print("🔍 测试 GET 请求（获取 Feed）...")
    try:
        result = client.ig.get_feed()
        print(f"✅ GET 请求成功")
        print(f"   Feed items: {len(result.get('items', []))}")
    except Exception as e:
        print(f"❌ GET 请求失败: {e}")
        import traceback
        traceback.print_exc()
        return

    print()

    # 测试一个需要 POST 的简单操作
    print("🔍 测试 POST 请求（获取媒体评论）...")
    try:
        # 使用一个已知的媒体 ID
        result = client.ig.get_media_comments(
            media_id="3913384059204773903",
            sort_order="popular"
        )
        print(f"✅ POST 请求成功")
        print(f"   Comments: {len(result.get('comments', []))}")
    except Exception as e:
        print(f"❌ POST 请求失败: {e}")
        import traceback
        traceback.print_exc()
        return

    print()
    print(f"{'='*60}")
    print(f"✅ 所有请求通过！CSRF token 正常")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    main()