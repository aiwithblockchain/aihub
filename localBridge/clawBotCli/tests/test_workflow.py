#!/usr/bin/env python3
"""
Test Complete Workflow (Multiple APIs Combined)
测试场景 10: 完整工作流测试

模拟真实使用场景，组合多个 API 完成完整的工作流程
"""
import sys
import os
import time
from typing import Any, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def resolve_instance_id(client: ClawBotClient, preferred_instance_id: Optional[str] = None) -> Optional[str]:
    if preferred_instance_id:
        return preferred_instance_id

    instances_payload: Any = client.x.status.get_instances()
    if isinstance(instances_payload, dict):
        instances = instances_payload.get("instances") or []
    elif isinstance(instances_payload, list):
        instances = instances_payload
    else:
        instances = []

    if not instances:
        return None

    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")
    return str(instance_id) if instance_id else None


def should_run_live_actions() -> bool:
    if len(sys.argv) > 1 and sys.argv[1] == "--run-live-actions":
        return True
    return sys.stdin.isatty()


def workflow_read_and_interact():
    """
    工作流 1: 读取时间线并进行互动
    1. 查询状态
    2. 获取时间线
    3. 提取推文 ID
    4. 点赞推文
    5. 取消点赞
    """
    print("\n" + "="*60)
    print("Workflow 1: Read Timeline and Interact")
    print("="*60)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client)

    # Step 1: Check status
    print("\n📍 Step 1: Checking X status...")
    status = client.x.status.get_status(instance_id=instance_id)
    if not status.is_logged_in:
        print("❌ Not logged in")
        return False
    print(f"✅ Logged in, {len(status.tabs)} tabs open")

    # Step 2: Get timeline
    print("\n📍 Step 2: Fetching timeline...")
    tweet = client.x.timeline.get_first_timeline_tweet(instance_id=instance_id)
    if not tweet:
        print("❌ Failed to get timeline")
        return False
    print("✅ Timeline fetched")

    # Step 3: Extract tweet ID
    print("\n📍 Step 3: Extracting tweet ID...")
    tweet_id = tweet.id
    if not tweet_id:
        print("❌ No tweet ID found")
        return False
    print(f"✅ Found tweet ID: {tweet_id}")

    if not should_run_live_actions():
        print("⏭️  Skipping like/unlike in non-interactive mode")
        print("\n✅ Workflow 1 completed successfully")
        return True

    # Step 4: Like tweet
    print("\n📍 Step 4: Liking tweet...")
    print("⚠️  This will like a real tweet!")
    if len(sys.argv) > 1 and sys.argv[1] == "--run-live-actions":
        confirm = "yes"
    else:
        confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Workflow cancelled")
        return True

    result = client.x.actions.like(tweet_id)
    if not result.success:
        print("❌ Failed to like tweet")
        return False
    print("✅ Tweet liked")

    time.sleep(2)

    # Step 5: Unlike tweet
    print("\n📍 Step 5: Unliking tweet...")
    result = client.x.actions.unlike(tweet_id)
    if not result.success:
        print("❌ Failed to unlike tweet")
        return False
    print("✅ Tweet unliked")

    print("\n✅ Workflow 1 completed successfully")
    return True


def workflow_search_and_profile():
    """
    工作流 2: 搜索并查看用户资料
    1. 搜索关键词
    2. 提取用户名
    3. 查询用户资料
    """
    print("\n" + "="*60)
    print("Workflow 2: Search and View Profile")
    print("="*60)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client)

    # Step 1: Search
    print("\n📍 Step 1: Searching for 'AI'...")
    tweets, users = client.x.search.search("AI", count=5, instance_id=instance_id)
    if not tweets and not users:
        print("❌ Search failed")
        return False
    print("✅ Search completed")

    # Step 2: Extract screen name
    print("\n📍 Step 2: Extracting user screen name...")
    screen_name = None

    if users:
        screen_name = users[0].screen_name
    elif tweets and tweets[0].user_screen_name:
        screen_name = tweets[0].user_screen_name
    else:
        screen_name = "elonmusk"

    print(f"✅ Using screen name: {screen_name}")

    # Step 3: Get user profile
    print("\n📍 Step 3: Fetching user profile...")
    user = client.x.users.get_user(screen_name, instance_id=instance_id)
    if not user:
        print("❌ Failed to get profile")
        return False
    print("✅ Profile fetched")

    print("\n✅ Workflow 2 completed successfully")
    return True


def workflow_tab_navigation():
    """
    工作流 3: 标签页导航
    1. 打开新标签页
    2. 导航到不同页面
    3. 关闭标签页
    """
    print("\n" + "="*60)
    print("Workflow 3: Tab Navigation")
    print("="*60)

    client = ClawBotClient()
    instance_id = resolve_instance_id(client)

    # Step 1: Open tab
    print("\n📍 Step 1: Opening new tab...")
    tab = client.x.tabs.open("home", instance_id=instance_id)
    if not tab or not tab.tab_id:
        print("❌ Failed to open tab")
        return False
    tab_id = tab.tab_id
    print(f"✅ Tab opened: {tab_id}")

    time.sleep(2)

    # Step 2: Navigate
    print("\n📍 Step 2: Navigating to notifications...")
    result = client.x.tabs.navigate("notifications", tab_id, instance_id=instance_id)
    if not result.success:
        print("❌ Navigation failed")
        return False
    print("✅ Navigated successfully")

    time.sleep(1)

    # Step 3: Close tab
    print("\n📍 Step 3: Closing tab...")
    result = client.x.tabs.close(tab_id, instance_id=instance_id)
    if not result.success:
        print("❌ Failed to close tab")
        return False
    print("✅ Tab closed")

    print("\n✅ Workflow 3 completed successfully")
    return True


if __name__ == "__main__":
    print("\n🧪 Testing Complete Workflows (Scenario 10)")
    print("="*60)
    print("This test combines multiple APIs to simulate real usage scenarios")
    print("="*60)

    results = []

    # Workflow 1: Read and interact
    results.append(("Read and Interact", workflow_read_and_interact()))

    # Workflow 2: Search and profile
    results.append(("Search and Profile", workflow_search_and_profile()))

    # Workflow 3: Tab navigation
    results.append(("Tab Navigation", workflow_tab_navigation()))

    print("\n" + "="*60)
    print("Test Summary:")
    print("="*60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} workflows passed")

    sys.exit(0 if passed == total else 1)
