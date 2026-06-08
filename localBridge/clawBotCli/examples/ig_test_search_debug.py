#!/usr/bin/env python3
"""
Instagram API 测试：搜索原始响应调试

用于检查分页信息是否正确返回
"""

import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 examples/ig_test_search_debug.py <query>")
        sys.exit(1)

    query = sys.argv[1]

    print(f"\n{'='*60}")
    print(f"调试：Instagram 搜索 API 原始响应")
    print(f"{'='*60}")
    print(f"搜索关键词: {query}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 获取原始响应
        print(f"📄 发送搜索请求...")
        result = client.ig.search(query, first=10)

        print(f"\n✅ 响应结构:")
        print(f"   success: {result.get('success')}")
        print(f"   results count: {len(result.get('results', []))}")
        print(f"   hasMore: {result.get('hasMore')}")
        print(f"   endCursor: {result.get('endCursor')}")
        print(f"   startCursor: {result.get('startCursor')}")

        # 保存完整响应
        output_file = f"search_debug_{query.replace('#', '').replace(' ', '_')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\n📄 完整响应已保存到: {output_file}")
        print(f"\n{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()