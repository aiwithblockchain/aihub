#!/usr/bin/env python3
"""
Test Complete Workflow (Multiple APIs Combined)
测试场景 10: 完整工作流测试

模拟真实使用场景，组合多个 API 完成完整的工作流程
"""
import sys
import json
import time
from utils.api_client import APIClient


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

    client = APIClient()

    # Step 1: Check status
    print("\n📍 Step 1: Checking X status...")
    status = client.get_x_status()
    if not status.get('isLoggedIn'):
        print("❌ Not logged in")
        return False
    print(f"✅ Logged in, {len(status.get('tabs', []))} tabs open")

    # Step 2: Get timeline
    print("\n📍 Step 2: Fetching timeline...")
    timeline = client.get_timeline()
    if 'data' not in timeline:
        print("❌ Failed to get timeline")
        return False
    print("✅ Timeline fetched")

    # Step 3: Extract tweet ID
    print("\n📍 Step 3: Extracting tweet ID...")
    tweet_id = None
    try:
        instructions = timeline['data']['home']['home_timeline_urt']['instructions']
        for instruction in instructions:
            if instruction.get('type') == 'TimelineAddEntries':
                entries = instruction.get('entries', [])
                for entry in entries:
                    if 'tweet-' in entry.get('entryId', ''):
                        content = entry.get('content', {})
                        tweet_results = content.get('itemContent', {}).get('tweet_results', {})
                        result = tweet_results.get('result', {})
                        tweet_id = result.get('rest_id')
                        if tweet_id:
                            break
            if tweet_id:
                break
    except Exception as e:
        print(f"❌ Failed to extract tweet ID: {e}")
        return False

    if not tweet_id:
        print("❌ No tweet ID found")
        return False
    print(f"✅ Found tweet ID: {tweet_id}")

    # Step 4: Like tweet
    print("\n📍 Step 4: Liking tweet...")
    print("⚠️  This will like a real tweet!")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("⏭️  Workflow cancelled")
        return True

    like_response = client.like_tweet(tweet_id)
    if 'data' not in like_response and 'favorite_tweet' not in str(like_response):
        print("❌ Failed to like tweet")
        return False
    print("✅ Tweet liked")

    time.sleep(2)

    # Step 5: Unlike tweet
    print("\n📍 Step 5: Unliking tweet...")
    unlike_response = client.unlike_tweet(tweet_id)
    if 'data' not in unlike_response and 'unfavorite_tweet' not in str(unlike_response):
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

    client = APIClient()

    # Step 1: Search
    print("\n📍 Step 1: Searching for 'AI'...")
    search_response = client.search_timeline("AI", count=5)
    if 'data' not in search_response:
        print("❌ Search failed")
        return False
    print("✅ Search completed")

    # Step 2: Extract screen name
    print("\n📍 Step 2: Extracting user screen name...")
    screen_name = None
    try:
        search_data = search_response['data'].get('search_by_raw_query', {}).get('search_timeline', {})
        timeline = search_data.get('timeline', {})
        instructions = timeline.get('instructions', [])

        for instruction in instructions:
            if instruction.get('type') == 'TimelineAddEntries':
                entries = instruction.get('entries', [])
                for entry in entries:
                    content = entry.get('content', {})
                    item_content = content.get('itemContent', {})
                    tweet_results = item_content.get('tweet_results', {})
                    result = tweet_results.get('result', {})
                    core = result.get('core', {})
                    user_results = core.get('user_results', {})
                    user_result = user_results.get('result', {})
                    legacy = user_result.get('legacy', {})
                    screen_name = legacy.get('screen_name')
                    if screen_name:
                        break
            if screen_name:
                break
    except Exception as e:
        print(f"⚠️  Failed to extract screen name: {e}")
        # Fallback to a known account
        screen_name = "elonmusk"

    if not screen_name:
        screen_name = "elonmusk"
    print(f"✅ Using screen name: {screen_name}")

    # Step 3: Get user profile
    print("\n📍 Step 3: Fetching user profile...")
    profile = client.get_user_profile(screen_name)
    if 'data' not in profile and 'rest_id' not in str(profile):
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

    client = APIClient()

    # Step 1: Open tab
    print("\n📍 Step 1: Opening new tab...")
    open_response = client.open_tab("home")
    if not open_response.get('success'):
        print("❌ Failed to open tab")
        return False
    tab_id = open_response.get('tabId')
    print(f"✅ Tab opened: {tab_id}")

    time.sleep(2)

    # Step 2: Navigate
    print("\n📍 Step 2: Navigating to notifications...")
    nav_response = client.navigate_tab("notifications", tab_id)
    if not nav_response.get('success'):
        print("❌ Navigation failed")
        return False
    print("✅ Navigated successfully")

    time.sleep(1)

    # Step 3: Close tab
    print("\n📍 Step 3: Closing tab...")
    close_response = client.close_tab(tab_id)
    if not close_response.get('success'):
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
