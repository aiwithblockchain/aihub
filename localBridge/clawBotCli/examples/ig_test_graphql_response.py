#!/usr/bin/env python3
"""
Instagram API 测试：搜索原始 GraphQL 响应

检查 TypeScript 返回的原始数据结构
"""

import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot.transport.base import BaseApiTransport


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 examples/ig_test_graphql_response.py <query>")
        sys.exit(1)

    query = sys.argv[1]

    print(f"\n{'='*60}")
    print(f"调试：Instagram 搜索原始 GraphQL 响应")
    print(f"{'='*60}")
    print(f"搜索关键词: {query}")
    print(f"{'='*60}\n")

    # 创建 Transport 直接访问
    transport = BaseApiTransport()

    try:
        # 发送请求
        print(f"📄 发送搜索请求...")
        result = transport.request_json(
            "POST",
            "/api/v1/ig/search",
            json={"query": query, "first": 10}
        )

        # 保存完整响应
        output_file = f"graphql_response_{query.replace('#', '').replace(' ', '_')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\n✅ 响应已保存到: {output_file}")

        # 检查关键字段
        print(f"\n📊 响应结构分析:")
        print(f"   success: {result.get('success')}")
        print(f"   results count: {len(result.get('results', []))}")
        print(f"   hasMore: {result.get('hasMore')}")
        print(f"   endCursor: {result.get('endCursor')}")
        print(f"   startCursor: {result.get('startCursor')}")

        # 如果有原始数据字段，检查它
        if 'rawData' in result:
            print(f"\n🔍 检测到 rawData 字段")
            raw = result['rawData']
            if isinstance(raw, dict):
                print(f"   rawData keys: {list(raw.keys())[:10]}")

                # 检查 GraphQL 路径
                connection = raw.get('data', {}).get('xdt_fbsearch__top_serp_graphql', {})
                if connection:
                    print(f"\n   ✅ 找到 xdt_fbsearch__top_serp_graphql")
                    page_info = connection.get('page_info', {})
                    if page_info:
                        print(f"   page_info: {json.dumps(page_info, indent=6)}")
                    else:
                        print(f"   ⚠️  未找到 page_info")

        print(f"\n{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()