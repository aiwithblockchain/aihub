#!/usr/bin/env python3
"""
Instagram API 测试：获取通知列表

使用方法：
  python3 ig_test_21_get_notifications.py

示例：
  python3 examples/ig_test_21_get_notifications.py
"""

import sys
import os
import time

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    print(f"\n{'='*60}")
    print(f"测试：获取通知列表")
    print(f"{'='*60}\n")

    # 创建 Client
    client = ClawBotClient()

    try:
        # 获取通知
        print(f"🔔 获取通知...")
        start_time = time.time()
        result = client.ig.get_notifications()
        elapsed_time = time.time() - start_time

        notifications = result.get('notifications', [])
        new_stories = result.get('newStories', [])
        old_stories = result.get('oldStories', [])
        partition = result.get('partition', {})

        print(f"✅ 获取成功")
        print(f"   总通知数:     {len(notifications)}")
        print(f"   新通知:       {len(new_stories)}")
        print(f"   旧通知:       {len(old_stories)}")
        print(f"   响应时间:     {elapsed_time:.2f}s")
        print()

        # 显示时间分区
        if partition:
            headers = partition.get('headers', [])
            indices = partition.get('indices', [])
            print(f"📅 时间分区:")
            for i, header in enumerate(headers):
                start_idx = indices[i] if i < len(indices) else 0
                end_idx = indices[i + 1] if i + 1 < len(indices) else len(notifications)
                print(f"   {header}: {end_idx - start_idx} 条通知")
            print()

        # 显示通知详情（前 5 条）
        if notifications:
            print(f"📋 通知详情（前 5 条）:")
            for i, notif in enumerate(notifications[:5]):
                print(f"\n   [{i+1}] {notif.get('text', 'N/A')[:80]}")
                print(f"       类型:     {notif.get('type', 'unknown')} (code: {notif.get('typeCode', 0)})")
                print(f"       时间:     {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(notif.get('timestamp', 0)))}")
                if notif.get('user'):
                    user = notif['user']
                    print(f"       用户:     {user.get('username', 'N/A')} ({user.get('id', 'N/A')})")
                if notif.get('media'):
                    media = notif['media']
                    print(f"       媒体:     {media.get('shortcode', 'N/A')}")
        else:
            print("   暂无通知")

        print()
        print(f"{'='*60}")
        print(f"✅ 测试通过！通知获取成功")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()