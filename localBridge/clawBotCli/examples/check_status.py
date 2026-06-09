#!/usr/bin/env python3
"""
检查 LocalBridge 和 Chrome 扩展连接状态
"""

import sys
import os
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check_status():
    print("\n" + "="*60)
    print("LocalBridge 连接状态检查")
    print("="*60 + "\n")

    # 1. 检查 LocalBridge 是否运行
    print("1️⃣  检查 LocalBridge 服务...")
    try:
        response = requests.get("http://127.0.0.1:10088/api/v1/plugins", timeout=5)
        if response.status_code == 200:
            plugins = response.json()
            print(f"   ✅ LocalBridge 运行中")
            print(f"   已连接插件数量: {len(plugins)}")

            # 查找 tweetClaw 插件
            tweetclaw = None
            for plugin in plugins:
                if plugin.get('clientName') == 'tweetClaw':
                    tweetclaw = plugin
                    break

            if tweetclaw:
                print(f"\n2️⃣  TweetClaw 插件状态:")
                print(f"   ✅ TweetClaw 已连接")
                print(f"   Client ID: {tweetclaw.get('clientId', 'N/A')}")

                # 检查 capabilities
                caps = tweetclaw.get('capabilities', [])
                print(f"   Capabilities: {', '.join(caps) if caps else 'None'}")

                # 检查是否支持 Instagram
                ig_caps = [cap for cap in caps if 'ig_' in cap.lower()]
                if ig_caps:
                    print(f"   ✅ Instagram 功能: {', '.join(ig_caps)}")
                else:
                    print(f"   ⚠️  未找到 Instagram 功能")
            else:
                print(f"\n2️⃣  TweetClaw 插件状态:")
                print(f"   ❌ TweetClaw 未连接")
                print(f"   请确保:")
                print(f"   - Chrome 扩展已加载")
                print(f"   - 在 Instagram 页面上（https://www.instagram.com/）")
        else:
            print(f"   ❌ LocalBridge 响应异常: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print(f"   ❌ LocalBridge 未运行")
        print(f"   请启动 LocalBridge")
        return
    except Exception as e:
        print(f"   ❌ 检查失败: {e}")
        return

    print("\n" + "="*60)
    print("检查完成")
    print("="*60 + "\n")

if __name__ == '__main__':
    check_status()