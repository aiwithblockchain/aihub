#!/usr/bin/env python3
"""
Instagram API 测试：搜索功能

使用方法：
  python3 ig_test_18_search.py <query>

示例：
  python3 examples/ig_test_18_search.py "#photography"
  python3 examples/ig_test_18_search.py "instagram"
  python3 examples/ig_test_18_search.py "tokyo"
"""

import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    query = sys.argv[1]

    print(f"\n{'='*60}")
    print(f"测试：搜索 Instagram 内容")
    print(f"{'='*60}")
    print(f"搜索关键词: {query}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 执行搜索
        print(f"🔍 正在搜索...")
        result = client.ig.search(query)

        # 解析结果
        results = result.get('results', [])
        has_more = result.get('hasMore', False)

        print(f"✅ 搜索完成")
        print(f"   结果数量: {len(results)}")
        print(f"   是否有更多: {has_more}")
        print()

        # 分类显示结果
        users = [r for r in results if r.get('user')]
        hashtags = [r for r in results if r.get('hashtag')]
        places = [r for r in results if r.get('place')]

        # 显示用户结果
        if users:
            print(f"📱 用户结果 ({len(users)}):")
            for i, r in enumerate(users[:5], 1):
                user = r['user']
                print(f"   {i}. @{user.get('username', 'N/A')}")
                print(f"      全名: {user.get('full_name', 'N/A')}")
                print(f"      粉丝: {user.get('follower_count', 0):,}")
                print(f"      认证: {'✓' if user.get('is_verified') else '✗'}")
                print()

        # 显示标签结果
        if hashtags:
            print(f"🏷️  标签结果 ({len(hashtags)}):")
            for i, r in enumerate(hashtags[:5], 1):
                hashtag = r['hashtag']
                print(f"   {i}. #{hashtag.get('name', 'N/A')}")
                print(f"      媒体数: {hashtag.get('media_count', 0):,}")
                print()

        # 显示地点结果
        if places:
            print(f"📍 地点结果 ({len(places)}):")
            for i, r in enumerate(places[:5], 1):
                place = r['place']['location']
                print(f"   {i}. {place.get('name', 'N/A')}")
                print(f"      坐标: ({place.get('lat', 0)}, {place.get('lng', 0)})")
                print()

        # 保存完整结果到文件
        output_file = f"search_result_{query.replace('#', '').replace(' ', '_')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"📄 完整结果已保存到: {output_file}")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！搜索功能正常")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()