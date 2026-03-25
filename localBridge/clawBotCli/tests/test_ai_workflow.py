#!/usr/bin/env python3
"""
Test AIClaw Complete Workflow
"""
import sys
import json
import time
from utils.api_client import APIClient

def test_complete_workflow():
    """Test complete AI interaction workflow"""
    print("\n🤖 Testing Complete AIClaw Workflow")
    print("="*60)

    client = APIClient()

    # Step 1: Check status
    print("\n[Step 1] Checking AI tabs status...")
    status = client.get_ai_status()
    if not status.get('tabs'):
        print("❌ No AI tabs found. Please open ChatGPT in browser.")
        return False
    print(f"✅ Found {len(status['tabs'])} AI tab(s)")

    # Step 2: Navigate to home
    print("\n[Step 2] Navigating to ChatGPT home...")
    nav_result = client.navigate_ai_platform('chatgpt')
    if not nav_result.get('success'):
        print("❌ Navigation failed")
        return False
    print("✅ Navigation successful")
    time.sleep(2)

    # Step 3: Create new conversation
    print("\n[Step 3] Creating new conversation...")
    new_conv = client.new_ai_conversation('chatgpt')
    if not new_conv.get('success'):
        print("❌ Failed to create conversation")
        return False
    print("✅ New conversation created")
    time.sleep(2)

    # Step 4: Send first message
    print("\n[Step 4] Sending first message...")
    msg1 = client.send_ai_message(
        platform='chatgpt',
        prompt='Please respond with just the number 42'
    )
    if not msg1.get('success'):
        print("❌ Failed to send message")
        return False
    print(f"✅ Received response: {msg1.get('content', '')[:100]}")

    # Step 5: Send follow-up message
    print("\n[Step 5] Sending follow-up message...")
    msg2 = client.send_ai_message(
        platform='chatgpt',
        prompt='What number did you just say?',
        conversation_id=msg1.get('conversationId')
    )
    if not msg2.get('success'):
        print("❌ Failed to send follow-up")
        return False
    print(f"✅ Received response: {msg2.get('content', '')[:100]}")

    print("\n" + "="*60)
    print("✅ Complete workflow test PASSED")
    return True

if __name__ == '__main__':
    success = test_complete_workflow()
    sys.exit(0 if success else 1)
