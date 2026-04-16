#!/usr/bin/env python3
"""OpenClaw demo script rebuilt on top of the clawbot library."""

import argparse
import sys
from typing import Optional

from clawbot import ClawBotClient
from clawbot.errors import ParseError


def choose_logged_in_platform(client: ClawBotClient) -> Optional[str]:
    print("\n" + "=" * 60)
    print("📍 Step 1: Testing aiClaw Connectivity")
    print("=" * 60)
    status = client.ai.status.get_status()
    tabs = status.get("tabs", [])
    if not tabs:
        print("❌ No AI platform tabs found")
        return None

    print(f"✅ Found {len(tabs)} AI tab(s)")
    platforms = status.get("platforms", {})
    selected = None
    for platform_name, platform_info in platforms.items():
        has_tab = platform_info.get("hasTab", False)
        is_logged_in = platform_info.get("isLoggedIn", False)
        if has_tab:
            print(f"   - {platform_name}: {'✅ logged in' if is_logged_in else '❌ not logged in'}")
        if has_tab and is_logged_in and not selected:
            selected = platform_name

    if not selected:
        print("❌ No AI platform is logged in")
        return None
    print(f"✅ Will use {selected} for AI analysis")
    return selected


def ensure_x_ready(client: ClawBotClient) -> Optional[int]:
    print("\n" + "=" * 60)
    print("📍 Step 2: Testing TweetClaw Connectivity")
    print("=" * 60)
    instances = client.x.status.get_instances()
    if not isinstance(instances, list) or not instances:
        print("❌ No tweetClaw instances connected")
        return None
    print(f"✅ Found {len(instances)} tweetClaw instance(s)")

    status = client.x.status.get_status()
    if not status.is_logged_in:
        print("❌ Not logged in to X.com")
        return None
    if not status.tabs:
        print("❌ No X.com tabs open")
        return None
    tab_id = status.tabs[0].tab_id
    print(f"✅ Logged in to X.com with tab ID: {tab_id}")
    return tab_id


def get_pinned_tweet(client: ClawBotClient, username: str, tab_id: Optional[int]):
    print("\n" + "=" * 60)
    print(f"📍 Step 3: Fetching Pinned Tweet from @{username}")
    print("=" * 60)
    client.x.tabs.navigate(username, tab_id=tab_id)
    tweet = client.x.users.get_pinned_tweet(username, tab_id=tab_id)
    if not tweet or not tweet.id:
        raise ParseError(f"No pinned tweet found for @{username}")
    print(f"✅ Found pinned tweet ID: {tweet.id}")
    print("\n📝 Tweet content:")
    print("-" * 60)
    print(tweet.text)
    print("-" * 60)
    return tweet


def analyze_with_ai(client: ClawBotClient, platform: str, tweet_text: str) -> str:
    print("\n" + "=" * 60)
    print("📍 Step 4: Analyzing Tweet with AI")
    print("=" * 60)
    prompt = f"""请分析这篇推文要表达的内容，然后思考一下我们的 aihub 作为一个降低 openclaw 消耗 token 的方案，能否得到他的帮助和推广。推文内容：{tweet_text}

要求：
1. 直接生成一条推特回复（不要包含\"推文内容分析\"等标题）
2. 回复内容控制在280字符以内
3. 语气友好、简洁
4. 必须包含我们的网站地址：https://aiwithblockchain.github.io/
5. 用英文回复（因为原推文是英文）"""
    result = client.ai.chat.send_message(platform=platform, prompt=prompt)
    if not result.success or not result.content:
        raise ParseError("AI did not return usable reply content")
    print("✅ AI analysis completed")
    print("\n💡 AI suggested reply:")
    print("-" * 60)
    print(result.content)
    print("-" * 60)
    return result.content


def post_reply(client: ClawBotClient, tweet_id: str, reply_text: str):
    print("\n" + "=" * 60)
    print("📍 Step 5: Posting Reply to Tweet")
    print("=" * 60)
    if len(reply_text) > 280:
        reply_text = reply_text[:277] + "..."
    result = client.x.actions.reply(tweet_id, reply_text)
    if not result.success:
        raise ParseError(result.message or "Reply failed")
    print("✅ Reply posted successfully")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenClaw demo built on clawbot library")
    parser.add_argument("--username", "-u", default="openclaw", help="Twitter username to fetch pinned tweet from")
    args = parser.parse_args()

    username = args.username
    print("\n🤖 OpenClaw Demo")
    print("=" * 60)
    print("This script will:")
    print("1. Test aiClaw and tweetClaw connectivity")
    print(f"2. Fetch pinned tweet from @{username}")
    print("3. Analyze with AI")
    print("4. Post a reply")
    print("=" * 60)

    client = ClawBotClient()
    platform = choose_logged_in_platform(client)
    if not platform:
        return 1
    tab_id = ensure_x_ready(client)
    if tab_id is None:
        return 1
    tweet = get_pinned_tweet(client, username, tab_id)
    reply_text = analyze_with_ai(client, platform, tweet.text or "")
    post_reply(client, tweet.id, reply_text)
    print("\n✅ Workflow completed successfully!")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Script interrupted by user")
        sys.exit(1)
    except Exception as exc:
        print(f"\n\n❌ Unexpected error: {exc}")
        raise
