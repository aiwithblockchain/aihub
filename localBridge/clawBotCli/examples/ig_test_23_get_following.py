#!/usr/bin/env python3
"""
测试 Instagram 获取关注列表 API

测试场景：
1. 获取自己的关注列表
2. 验证返回数据格式
3. 测试分页功能

使用方法：
python ig_test_23_get_following.py
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_get_following():
    """测试获取关注列表"""
    print("=" * 60)
    print("测试 Instagram 获取关注列表 API")
    print("=" * 60)

    # 创建 API 客户端
    client = ClawBotClient()

    # 步骤 1: 获取当前用户信息
    print("\n[步骤 1] 获取当前用户信息...")
    try:
        user_info = client.ig.get_account_info()
        user_id = user_info.get("userId") or user_info.get("pk")
        username = user_info.get("username")
        print(f"✅ 当前用户: {username} (ID: {user_id})")
    except Exception as e:
        print(f"❌ 获取用户信息失败: {e}")
        return False

    # 步骤 2: 获取关注列表（第一页）
    print("\n[步骤 2] 获取关注列表（第一页）...")
    try:
        result = client.ig.get_following(user_id=user_id, count=12)

        users = result.get("users", [])
        has_more = result.get("hasMore", False)
        next_max_id = result.get("nextMaxId")
        page_size = result.get("pageSize", 0)

        print(f"✅ 获取成功！")
        print(f"   - 关注数量: {len(users)}")
        print(f"   - 是否有更多: {has_more}")
        print(f"   - 下一页游标: {next_max_id}")
        print(f"   - 每页数量: {page_size}")

        # 打印关注列表
        if users:
            print("\n   关注列表:")
            for i, user in enumerate(users, 1):
                username = user.get("username", "unknown")
                full_name = user.get("fullName", "")
                is_private = user.get("isPrivate", False)
                is_verified = user.get("isVerified", False)

                status = "🔒" if is_private else "🌐"
                verified = "✓" if is_verified else ""
                print(f"   {i:2d}. {status} @{username} ({full_name}) {verified}")
        else:
            print("\n   ⚠️  没有关注任何人")

    except Exception as e:
        print(f"❌ 获取关注列表失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 步骤 3: 测试分页（如果有更多关注）
    if has_more and next_max_id:
        print(f"\n[步骤 3] 测试分页（获取下一页）...")
        try:
            result2 = client.ig.get_following(user_id=user_id, count=12, max_id=next_max_id)

            users2 = result2.get("users", [])
            has_more2 = result2.get("hasMore", False)
            next_max_id2 = result2.get("nextMaxId")

            print(f"✅ 获取第二页成功！")
            print(f"   - 关注数量: {len(users2)}")
            print(f"   - 是否有更多: {has_more2}")
            print(f"   - 下一页游标: {next_max_id2}")

            if users2:
                print("\n   第二页关注:")
                for i, user in enumerate(users2, 1):
                    username = user.get("username", "unknown")
                    full_name = user.get("fullName", "")
                    print(f"   {i:2d}. @{username} ({full_name})")

        except Exception as e:
            print(f"❌ 获取第二页失败: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("\n[步骤 3] 跳过分页测试（关注数量较少）")

    print("\n" + "=" * 60)
    print("✅ 测试完成！")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_get_following()
    sys.exit(0 if success else 1)