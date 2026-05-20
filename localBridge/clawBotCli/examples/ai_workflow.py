#!/usr/bin/env python3
"""Example migrated from legacy AI workflow test."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🤖 Testing AI workflow with clawbot library")
    print("=" * 60)

    status = client.ai.status.get_status()
    if not status.get("tabs"):
        print("❌ No AI tabs found. Please open an AI platform in the browser.")
        return 1
    print(f"✅ Found {len(status['tabs'])} AI tab(s)")

    platform = client.ai.status.logged_in_platforms()[0] if client.ai.status.logged_in_platforms() else "chatgpt"
    nav_result = client.ai.navigation.navigate(platform)
    if not nav_result.success:
        print("❌ Navigation failed")
        return 1

    new_conv = client.ai.chat.new_conversation(platform)
    if not new_conv.success:
        print("❌ Failed to create conversation")
        return 1

    first = client.ai.chat.send_message(platform=platform, prompt="Please respond with just the number 42")
    if not first.success:
        print("❌ Failed to send first message")
        return 1
    print(f"✅ First response: {first.content}")

    second = client.ai.chat.send_message(
        platform=platform,
        prompt="What number did you just say?",
        conversation_id=first.conversation_id,
    )
    if not second.success:
        print("❌ Failed to send follow-up")
        return 1
    print(f"✅ Follow-up response: {second.content}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
