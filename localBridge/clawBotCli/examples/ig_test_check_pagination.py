#!/usr/bin/env python3
"""
Instagram API 测试：检查原始响应中的分页字段

直接查看 TypeScript 返回的完整响应结构
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "sunset"

    print(f"\n{'='*60}")
    print(f"检查原始响应的分页字段")
    print(f"{'='*60}")
    print(f"搜索关键词: {query}")
    print(f"{'='*60}\n")

    client = ClawBotClient()

    try:
        # 发送搜索请求
        result = client.ig.search(query, first=10)

        # 显示完整响应结构（不包含 results）
        print(f"响应顶层字段:")
        for key in ['success', 'hasMore', 'endCursor', 'startCursor', 'query']:
            value = result.get(key)
            print(f"  {key}: {value}")

        print(f"\n结果数量: {len(result.get('results', []))}")

        # 检查是否有其他字段
        all_keys = set(result.keys()) - {'results'}
        print(f"\n其他字段: {all_keys}")

        # 保存完整响应
        output_file = f"raw_response_{query}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\n完整响应已保存到: {output_file}")

        # 分析问题
        print(f"\n{'='*60}")
        print(f"问题分析:")
        print(f"{'='*60}")
        if result.get('hasMore') and not result.get('endCursor'):
            print(f"⚠️  检测到异常: hasMore=True 但 endCursor=None")
            print(f"   可能原因:")
            print(f"   1. TypeScript 解析逻辑未找到 page_info")
            print(f"   2. Instagram API 响应结构变化")
            print(f"   3. 需要查看浏览器控制台的调试日志")
            print(f"\n建议操作:")
            print(f"   1. 重新加载 Chrome 扩展")
            print(f"   2. 打开浏览器控制台 (F12)")
            print(f"   3. 再次运行搜索测试")
            print(f"   4. 查看控制台中的 '[IG API] Raw page_info' 日志")
        else:
            print(f"✅ 分页信息正常")

        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()