#!/usr/bin/env python3
"""
Instagram API 诊断脚本

检查所有前置条件是否满足
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient

def main():
    print(f"\n{'='*60}")
    print(f"Instagram API 诊断")
    print(f"{'='*60}\n")

    client = ClawBotClient()

    # 测试 1: 检查连接
    print("🔍 测试 1: 检查 localBridge 连接...")
    try:
        result = client.ig.test_connection()
        if result.get('success'):
            print(f"✅ 连接成功")
            print(f"   User ID: {result.get('userId')}")
        else:
            print(f"❌ 连接失败: {result.get('error')}")
            return
    except Exception as e:
        print(f"❌ 连接异常: {e}")
        return

    print()

    # 测试 2: 获取用户信息
    print("🔍 测试 2: 获取用户信息...")
    try:
        result = client.ig.get_account_info()
        print(f"✅ 用户信息获取成功")
        print(f"   Username: @{result.get('username')}")
        print(f"   Full Name: {result.get('fullName')}")
        print(f"   Followers: {result.get('followerCount')}")
        print(f"   User ID (pk): {result.get('pk')}")
        print(f"   User ID (id): {result.get('id')}")
        print(f"   Raw keys: {list(result.keys())[:10]}")
    except Exception as e:
        print(f"❌ 获取用户信息失败: {e}")
        import traceback
        traceback.print_exc()
        return

    print()

    # 测试 3: 检查登录状态
    print("🔍 测试 3: 检查登录状态...")
    try:
        is_logged_in = client.ig.check_login()
        if is_logged_in:
            print(f"✅ 已登录 Instagram")
        else:
            print(f"❌ 未登录 Instagram")
            return
    except Exception as e:
        print(f"❌ 检查登录状态失败: {e}")
        return

    print()
    print(f"{'='*60}")
    print(f"✅ 所有诊断通过！可以进行 API 测试")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    main()