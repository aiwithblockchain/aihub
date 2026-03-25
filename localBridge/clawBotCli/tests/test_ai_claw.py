#!/usr/bin/env python3
"""
Test AIClaw APIs
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.api_client import APIClient

def test_ai_status():
    """Test GET /api/v1/ai/status"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/ai/status")
    print("="*60)

    client = APIClient()
    response = client.get_ai_status()

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if 'tabs' in response:
        print(f"✅ Found {len(response['tabs'])} AI tab(s)")
        return True
    else:
        print("❌ Unexpected response format")
        return False

def test_send_message():
    """Test POST /api/v1/ai/message"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/ai/message")
    print("="*60)

    client = APIClient()
    response = client.send_ai_message(
        platform='chatgpt',
        prompt='Hello, please respond with just "Hi"'
    )

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success') and 'content' in response:
        print("✅ Message sent and received response")
        return True
    else:
        print("❌ Failed to send message")
        return False

def test_new_conversation():
    """Test POST /api/v1/ai/new_conversation"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/ai/new_conversation")
    print("="*60)

    client = APIClient()
    response = client.new_ai_conversation(platform='chatgpt')

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print("✅ New conversation created")
        return True
    else:
        print("❌ Failed to create conversation")
        return False

def test_navigate():
    """Test POST /api/v1/ai/navigate"""
    print("\n" + "="*60)
    print("Testing: POST /api/v1/ai/navigate")
    print("="*60)

    client = APIClient()
    response = client.navigate_ai_platform(platform='chatgpt')

    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print("✅ Navigation successful")
        return True
    else:
        print("❌ Navigation failed")
        return False

if __name__ == '__main__':
    print("\n🤖 AIClaw API Test Suite")
    print("="*60)

    results = []
    results.append(("AI Status", test_ai_status()))
    results.append(("Send Message", test_send_message()))
    results.append(("New Conversation", test_new_conversation()))
    results.append(("Navigate", test_navigate()))

    print("\n" + "="*60)
    print("Test Summary:")
    print("="*60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")

    sys.exit(0 if passed == total else 1)
