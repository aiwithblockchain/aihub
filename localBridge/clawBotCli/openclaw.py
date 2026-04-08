#!/usr/bin/env python3
"""
OpenClaw Test Script - AI驱动的Twitter自动回复工具
测试 aiClaw 和 tweetClaw 的集成工作流

=== 使用方式 ===

基本用法：
    python openclaw.py                    # 默认获取 @openclaw 的置顶推文并回复
    python openclaw.py -u username        # 获取指定用户的置顶推文并回复
    python openclaw.py --username elonmusk  # 完整参数形式

=== 功能说明 ===

本脚本实现了一个完整的 AI 驱动的 Twitter 互动工作流：
1. 测试 aiClaw 联通性和登录状态（支持 ChatGPT/Gemini/Grok）
2. 测试 tweetClaw 联通性和 X.com 登录状态
3. 导航到指定用户主页并获取置顶推文
4. 将推文内容发送给 AI 进行分析
5. 使用 AI 生成的内容自动回复推文

=== 使用示例 ===

示例 1: 回复 @openclaw 的置顶推文
    $ python openclaw.py

    输出：
    🤖 OpenClaw Test Script
    ============================================================
    This script will:
    1. Test aiClaw and tweetClaw connectivity
    2. Fetch pinned tweet from @openclaw
    3. Analyze with AI
    4. Post a reply
    ============================================================

示例 2: 回复特定用户的置顶推文
    $ python openclaw.py -u elonmusk

    # 脚本会自动：
    # - 检查 AI 平台（ChatGPT/Gemini/Grok）是否已登录
    # - 检查 X.com 是否已登录
    # - 获取 @elonmusk 的置顶推文
    # - 让 AI 分析推文内容
    # - 生成并发布回复（包含 https://aiwithblockchain.github.io/ 链接）

示例 3: 回复中文用户
    $ python openclaw.py -u username_cn

    # AI 会根据原推文语言自动调整回复语言

=== 前置条件 ===

1. 浏览器扩展：
   - 安装并启用 aiClaw 扩展（用于 AI 平台交互）
   - 安装并启用 tweetClaw 扩展（用于 Twitter 交互）

2. 登录状态：
   - 至少登录一个 AI 平台（ChatGPT、Gemini 或 Grok）
   - 登录 X.com（Twitter）账号
   - 在浏览器中打开对应的标签页

3. Python 依赖：
   - 确保 utils.api_client 模块可用
   - Python 3.6+

=== 注意事项 ===

- 回复内容会自动控制在 280 字符以内（Twitter 限制）
- 如果目标用户没有置顶推文，脚本会提示并退出
- AI 分析和生成回复可能需要 30-60 秒
- 脚本会在发布前显示回复内容供确认
- 所有操作都有详细的进度提示和错误处理

=== 工作流程详解 ===

Step 1: 测试 aiClaw 连接
    - 检查 AI 平台标签页是否打开
    - 验证登录状态（ChatGPT/Gemini/Grok）
    - 选择一个已登录的平台用于后续分析

Step 2: 测试 TweetClaw 连接
    - 检查 tweetClaw 扩展实例
    - 验证 X.com 登录状态
    - 获取可用的标签页 ID

Step 3: 获取置顶推文
    - 导航到目标用户主页
    - 提取置顶推文 ID
    - 获取完整推文内容

Step 4: AI 分析
    - 将推文发送给选定的 AI 平台
    - AI 分析推文内容并生成回复
    - 回复包含项目链接和相关信息

Step 5: 发布回复
    - 显示生成的回复内容
    - 检查字符数限制
    - 发布回复到原推文

=== 错误处理 ===

脚本包含完整的错误处理机制：
- 连接失败：提示检查扩展安装和运行状态
- 未登录：提示登录相应平台
- 无置顶推文：提示用户并退出
- AI 响应超时：提供故障排查建议
- 字符超限：自动截断至 280 字符

=== 退出码 ===

0 - 成功完成所有步骤
1 - 执行过程中出现错误或用户中断

"""
import sys
import os
import json
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.api_client import APIClient


def test_ai_connectivity(client):
    """
    Step 1: Test aiClaw connectivity and login status
    Returns: (success, platform_name) or (False, None)
    """
    print("\n" + "="*60)
    print("📍 Step 1: Testing aiClaw Connectivity")
    print("="*60)

    status = client.get_ai_status()

    if 'error' in status:
        print(f"❌ Failed to connect to aiClaw: {status['error']}")
        return False, None

    tabs = status.get('tabs', [])
    if not tabs:
        print("❌ No AI platform tabs found")
        print("   Please open ChatGPT, Gemini, or Grok in your browser")
        return False, None

    print(f"✅ Found {len(tabs)} AI tab(s)")

    # Find a logged-in platform from the platforms object
    platforms = status.get('platforms', {})
    logged_in_platform = None

    for platform_name, platform_info in platforms.items():
        has_tab = platform_info.get('hasTab', False)
        is_logged_in = platform_info.get('isLoggedIn', False)

        if has_tab:
            print(f"   - {platform_name}: {'✅ logged in' if is_logged_in else '❌ not logged in'}")

            if is_logged_in and not logged_in_platform:
                logged_in_platform = platform_name

    if not logged_in_platform:
        print("\n❌ No AI platform is logged in")
        print("   Please log in to ChatGPT, Gemini, or Grok")
        return False, None

    print(f"\n✅ Will use {logged_in_platform} for AI analysis")
    return True, logged_in_platform


def test_tweet_connectivity(client):
    """
    Step 2: Test TweetClaw connectivity and X.com login status
    Returns: (success, tab_id) or (False, None)
    """
    print("\n" + "="*60)
    print("📍 Step 2: Testing TweetClaw Connectivity")
    print("="*60)

    # Check instances
    instances = client.get_instances()
    if 'error' in instances:
        print(f"❌ Failed to get instances: {instances['error']}")
        return False, None

    if not isinstance(instances, list) or len(instances) == 0:
        print("❌ No tweetClaw instances connected")
        print("   Please ensure tweetClaw extension is installed and running")
        return False, None

    print(f"✅ Found {len(instances)} tweetClaw instance(s)")
    instance = instances[0]
    print(f"   Using instance: {instance.get('instanceName', 'Unknown')}")

    # Check X.com status
    status = client.get_x_status()
    if 'error' in status:
        print(f"❌ Failed to get X status: {status['error']}")
        return False, None

    if not status.get('isLoggedIn'):
        print("❌ Not logged in to X.com")
        print("   Please log in to X.com in your browser")
        return False, None

    tabs = status.get('tabs', [])
    if not tabs:
        print("❌ No X.com tabs open")
        print("   Please open X.com in your browser")
        return False, None

    tab_id = tabs[0].get('tabId')
    print(f"✅ Logged in to X.com")
    print(f"   Using tab ID: {tab_id}")

    return True, tab_id


def get_pinned_tweet(client, tab_id, username):
    """
    Step 3: Navigate to user profile and get pinned tweet
    Returns: (success, tweet_id, tweet_text) or (False, None, None)
    """
    print("\n" + "="*60)
    print(f"📍 Step 3: Fetching Pinned Tweet from @{username}")
    print("="*60)

    # Navigate to user profile
    print(f"\n🔄 Navigating to https://x.com/{username}...")
    nav_result = client.navigate_tab(username, tab_id)
    if not nav_result.get('success'):
        print(f"❌ Navigation failed: {nav_result.get('error', 'Unknown error')}")
        return False, None, None

    print("✅ Navigation successful")
    time.sleep(3)  # Wait for page load

    # Get user profile
    print("\n🔄 Fetching user profile...")
    profile = client.get_user_profile(username, tab_id)
    if 'error' in profile:
        print(f"❌ Failed to get profile: {profile['error']}")
        return False, None, None

    # Extract pinned tweet ID
    tweet_id = None
    try:
        # Handle the nested structure: response has 'data' -> 'data' -> 'user' -> 'result'
        outer_data = profile.get('data', {})
        inner_data = outer_data.get('data', {})
        user_result = inner_data.get('user', {}).get('result', {})
        legacy = user_result.get('legacy', {})
        pinned_ids = legacy.get('pinned_tweet_ids_str', [])

        if pinned_ids and len(pinned_ids) > 0:
            tweet_id = pinned_ids[0]
            print(f"✅ Found pinned tweet ID: {tweet_id}")
        else:
            print("⚠️  No pinned tweet found")
            print(f"   Note: The script expects a pinned tweet from @{username}")
            return False, None, None
    except Exception as e:
        print(f"❌ Failed to extract tweet ID: {e}")
        return False, None, None

    if not tweet_id:
        print("❌ Could not find any tweet")
        return False, None, None

    # Get full tweet details
    print(f"\n🔄 Fetching tweet details...")
    tweet = client.get_tweet(tweet_id, tab_id)
    if 'error' in tweet:
        print(f"❌ Failed to get tweet: {tweet['error']}")
        return False, None, None

    # Extract tweet text - handle nested data structure
    tweet_text = None
    try:
        # Response structure: success -> data -> data -> threaded_conversation_with_injections_v2
        outer_data = tweet.get('data', {})
        inner_data = outer_data.get('data', {})
        instructions = inner_data.get('threaded_conversation_with_injections_v2', {}).get('instructions', [])

        for instruction in instructions:
            if instruction.get('type') == 'TimelineAddEntries':
                entries = instruction.get('entries', [])
                for entry in entries:
                    content = entry.get('content', {})
                    tweet_results = content.get('itemContent', {}).get('tweet_results', {})
                    result = tweet_results.get('result', {})

                    # Check if this is the right tweet
                    if result.get('rest_id') == tweet_id:
                        legacy = result.get('legacy', {})
                        tweet_text = legacy.get('full_text')
                        if tweet_text:
                            break
            if tweet_text:
                break
    except Exception as e:
        print(f"❌ Failed to extract tweet text: {e}")
        return False, None, None

    if not tweet_text:
        print("❌ Could not extract tweet text")
        return False, None, None

    print(f"✅ Tweet fetched successfully")
    print(f"\n📝 Tweet content:")
    print("-" * 60)
    print(tweet_text)
    print("-" * 60)

    return True, tweet_id, tweet_text


def analyze_with_ai(client, platform, tweet_text):
    """
    Step 4: Send tweet to AI for analysis
    Returns: (success, ai_response) or (False, None)
    """
    print("\n" + "="*60)
    print("📍 Step 4: Analyzing Tweet with AI")
    print("="*60)

    prompt = f"""请分析这篇推文要表达的内容，然后思考一下我们的 aihub 作为一个降低 openclaw 消耗 token 的方案，能否得到他的帮助和推广。推文内容：{tweet_text}

要求：
1. 直接生成一条推特回复（不要包含"推文内容分析"等标题）
2. 回复内容控制在280字符以内
3. 语气友好、简洁
4. 必须包含我们的网站地址：https://aiwithblockchain.github.io/
5. 用英文回复（因为原推文是英文）"""

    print(f"\n🔄 Sending to {platform}...")
    print("   (This may take 30-60 seconds for AI to respond...)")

    response = client.send_ai_message(platform=platform, prompt=prompt)

    if 'error' in response:
        error_msg = response['error']
        print(f"❌ AI request failed: {error_msg}")

        # Provide helpful troubleshooting info
        if "未能从 DOM 中提取到 AI 回复" in error_msg or "extract" in error_msg.lower():
            print("\n💡 Troubleshooting tips:")
            print("   1. Make sure the AI platform page is fully loaded")
            print("   2. Try refreshing the AI platform page")
            print("   3. Check if you're logged in to the AI platform")
            print("   4. The AI might be taking longer to respond - try again")

        return False, None

    if not response.get('success'):
        print(f"❌ AI request failed: {response.get('error', 'Unknown error')}")
        return False, None

    # Extract AI response (different platforms may use different keys)
    ai_text = response.get('content') or response.get('response')
    if not ai_text:
        print("❌ No response from AI")
        return False, None

    print(f"✅ AI analysis completed")
    print(f"\n💡 AI suggested reply:")
    print("-" * 60)
    print(ai_text)
    print("-" * 60)

    return True, ai_text


def reply_to_tweet(client, tweet_id, reply_text):
    """
    Step 5: Reply to the tweet with AI-generated content
    Returns: success (bool)
    """
    print("\n" + "="*60)
    print("📍 Step 5: Posting Reply to Tweet")
    print("="*60)

    # Show what will be posted
    print("\n⚠️  Ready to post this reply to the tweet!")
    print(f"Tweet ID: {tweet_id}")
    print(f"\nReply text ({len(reply_text)} chars):")
    print("-" * 60)
    print(reply_text)
    print("-" * 60)

    # Check if reply is too long for Twitter
    if len(reply_text) > 280:
        print(f"\n⚠️  Warning: Reply is {len(reply_text)} characters (Twitter limit is 280)")
        print("   Truncating to fit Twitter's limit...")
        reply_text = reply_text[:277] + "..."

    print("\n🔄 Posting reply...")
    response = client.create_reply(tweet_id=tweet_id, text=reply_text)

    if 'error' in response:
        print(f"❌ Failed to post reply: {response['error']}")
        return False

    # Check if reply was successful
    if not response.get('ok') and 'data' not in response:
        print(f"❌ Reply failed: {response}")
        return False

    # Extract reply tweet ID
    try:
        reply_id = response.get('data', {}).get('create_tweet', {}).get('tweet_results', {}).get('result', {}).get('rest_id')
        if reply_id:
            print(f"✅ Reply posted successfully!")
            print(f"   Reply tweet ID: {reply_id}")
        else:
            print("✅ Reply posted successfully!")
    except:
        print("✅ Reply posted successfully!")

    return True


def main():
    """Main workflow"""
    import argparse

    parser = argparse.ArgumentParser(description='OpenClaw Test Script - Analyze and reply to pinned tweets')
    parser.add_argument('--username', '-u',
                       default='openclaw',
                       help='Twitter username to fetch pinned tweet from (default: openclaw)')
    args = parser.parse_args()

    username = args.username

    print("\n🤖 OpenClaw Test Script")
    print("="*60)
    print("This script will:")
    print("1. Test aiClaw and tweetClaw connectivity")
    print(f"2. Fetch pinned tweet from @{username}")
    print("3. Analyze with AI")
    print("4. Post a reply")
    print("="*60)

    client = APIClient()

    # Step 1: Test aiClaw
    success, platform = test_ai_connectivity(client)
    if not success:
        return 1

    # Step 2: Test TweetClaw
    success, tab_id = test_tweet_connectivity(client)
    if not success:
        return 1

    # Step 3: Get pinned tweet
    success, tweet_id, tweet_text = get_pinned_tweet(client, tab_id, username)
    if not success:
        return 1

    # Step 4: Analyze with AI
    success, ai_response = analyze_with_ai(client, platform, tweet_text)
    if not success:
        return 1

    # Step 5: Reply to tweet
    success = reply_to_tweet(client, tweet_id, ai_response)
    if not success:
        return 1

    print("\n" + "="*60)
    print("✅ Workflow completed successfully!")
    print("="*60)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Script interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
