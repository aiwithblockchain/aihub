#!/usr/bin/env python3
"""
Instagram API 测试：搜索功能（带分页）

使用方法：
  python3 ig_test_19_search_pagination.py <query> [page_size]

示例：
  python3 examples/ig_test_19_search_pagination.py "#photography" 10
  python3 examples/ig_test_19_search_pagination.py "sunset" 5
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
    page_size = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    print(f"\n{'='*60}")
    print(f"测试：Instagram 搜索 API（分页）")
    print(f"{'='*60}")
    print(f"搜索关键词: {query}")
    print(f"每页数量: {page_size}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 第一页
        print(f"📄 获取第一页...")
        result = client.ig.search(query, first=page_size)

        results = result.get('results', [])
        has_more = result.get('hasMore', False)
        end_cursor = result.get('endCursor')

        print(f"✅ 第一页完成")
        print(f"   结果数量: {len(results)}")
        print(f"   是否有更多: {has_more}")
        print(f"   End Cursor: {end_cursor[:50] if end_cursor else 'None'}...")
        print()

        # 显示前 3 个结果
        print(f"前 3 个结果:")
        for i, r in enumerate(results[:3], 1):
            if r.get('media'):
                media = r['media']
                user = media.get('user', {})
                print(f"   {i}. @{user.get('username', 'N/A')} - {media.get('code', 'N/A')}")
                print(f"      点赞: {media.get('like_count', 0):,}")
        print()

        # 如果有更多，获取第二页
        if has_more and end_cursor:
            print(f"📄 获取第二页（使用 end_cursor）...")
            result2 = client.ig.search(query, first=page_size, after=end_cursor)

            results2 = result2.get('results', [])
            has_more2 = result2.get('hasMore', False)
            end_cursor2 = result2.get('endCursor')

            print(f"✅ 第二页完成")
            print(f"   结果数量: {len(results2)}")
            print(f"   是否有更多: {has_more2}")
            print(f"   End Cursor: {end_cursor2[:50] if end_cursor2 else 'None'}...")
            print()

            # 显示前 3 个结果
            print(f"前 3 个结果:")
            for i, r in enumerate(results2[:3], 1):
                if r.get('media'):
                    media = r['media']
                    user = media.get('user', {})
                    print(f"   {i}. @{user.get('username', 'N/A')} - {media.get('code', 'N/A')}")
                    print(f"      点赞: {media.get('like_count', 0):,}")
            print()

            # 验证两页结果不重复
            codes1 = {r['media']['code'] for r in results if r.get('media')}
            codes2 = {r['media']['code'] for r in results2 if r.get('media')}
            overlap = codes1 & codes2

            print(f"🔍 分页验证:")
            print(f"   第一页结果数: {len(codes1)}")
            print(f"   第二页结果数: {len(codes2)}")
            print(f"   重复结果数: {len(overlap)}")
            if overlap:
                print(f"   ⚠️  警告: 发现重复结果!")
            else:
                print(f"   ✅ 无重复，分页正常")
            print()
        else:
            print(f"ℹ️  没有更多结果，跳过第二页测试")
            print()

        # 保存结果
        output_file = f"search_pagination_{query.replace('#', '').replace(' ', '_')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'query': query,
                'page_size': page_size,
                'page1': result,
                'page2': result2 if has_more and end_cursor else None,
            }, f, indent=2, ensure_ascii=False)

        print(f"📄 完整结果已保存到: {output_file}")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！分页功能正常")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()