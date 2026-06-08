#!/usr/bin/env python3
"""
Instagram API 测试：删除媒体（简化版）

使用方法：
  python3 ig_test_14_delete_media_simple.py <media_id>

示例：
  python3 examples/ig_test_14_delete_media_simple.py 3914739349371486362
"""

import sys
import os
import time

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    media_id = sys.argv[1]

    print(f"\n{'='*60}")
    print(f"测试：删除媒体")
    print(f"{'='*60}")
    print(f"Media ID:       {media_id}")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 删除媒体
        print(f"🗑️  删除媒体...")
        start_time = time.time()
        result = client.ig.delete_media(media_id=media_id)
        elapsed_time = time.time() - start_time

        did_delete = result.get('didDelete', False)
        status = result.get('status')

        if not did_delete:
            print(f"❌ 删除失败")
            print(f"   响应数据: {result}")
            sys.exit(1)

        print(f"✅ 媒体已删除")
        print(f"   删除状态:    {did_delete}")
        print(f"   响应状态:    {status}")
        print(f"   响应时间:    {elapsed_time:.2f}s")
        print()

        print(f"{'='*60}")
        print(f"✅ 测试通过！媒体删除成功")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()