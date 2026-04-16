#!/usr/bin/env python3
"""
Test AIClaw Complete Workflow
"""
import sys
import os
import json
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient

def test_complete_workflow():
    """Test complete AI interaction workflow"""
    print("\n🤖 Testing Complete AIClaw Workflow")
    print("="*60)

    client = ClawBotClient()

    # Step 1: Check status
    print("\n[Step 1] Checking AI tabs status...")
    status = client.ai.status.get_status()
    if not status.get('tabs'):
        print("❌ No AI tabs found. Please open ChatGPT in browser.")
        return False
    print(f"✅ Found {len(status['tabs'])} AI tab(s)")

    # Step 2: Navigate to home
    print("\n[Step 2] Navigating to ChatGPT home...")
    nav_result = client.ai.navigation.navigate('chatgpt')
    if not nav_result.success:
        print("❌ Navigation failed")
        return False
    print("✅ Navigation successful")
    time.sleep(2)

    # Step 3: Create new conversation
    print("\n[Step 3] Creating new conversation...")
    new_conv = client.ai.chat.new_conversation('chatgpt')
    if not new_conv.success:
        print("❌ Failed to create conversation")
        return False
    print("✅ New conversation created")
    time.sleep(2)

    # Step 4: Send first message
    print("\n[Step 4] Sending first message...")
    msg1 = client.ai.chat.send_message(
        platform='chatgpt',
        prompt='Please respond with just the number 42'
    )
    if not msg1.success:
        print("❌ Failed to send message")
        return False
    print(f"✅ Received response: {msg1.content[:100] if msg1.content else ''}")

    # Step 5: Send follow-up message
    print("\n[Step 5] Sending follow-up message...")
    msg2 = client.ai.chat.send_message(
        platform='chatgpt',
        prompt='What number did you just say?',
        conversation_id=msg1.conversation_id
    )
    if not msg2.success:
        print("❌ Failed to send follow-up")
        return False
    print(f"✅ Received response: {msg2.content[:100] if msg2.content else ''}")

    print("\n" + "="*60)
    print("✅ Complete workflow test PASSED")
    return True

if __name__ == '__main__':
    success = test_complete_workflow()
    sys.exit(0 if success else 1)
