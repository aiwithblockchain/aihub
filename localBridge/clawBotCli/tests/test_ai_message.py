#!/usr/bin/env python3
"""
Test AI Message API
Usage: python3 test_ai_message.py [platform] [message]
Example: python3 test_ai_message.py chatgpt "Hello"
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.api_client import APIClient

def main():
    # Parse arguments
    platform = sys.argv[1] if len(sys.argv) > 1 else 'chatgpt'
    message = sys.argv[2] if len(sys.argv) > 2 else 'Hi'

    print(f"\n💬 Testing: POST /api/v1/ai/message")
    print("="*60)
    print(f"Platform: {platform}")
    print(f"Message: {message}")
    print("="*60)

    client = APIClient()
    response = client.send_ai_message(
        platform=platform,
        prompt=message
    )

    print("\n📋 Response:")
    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success') and response.get('content'):
        content = response['content']
        print(f"\n✅ Success: Received response ({len(content)} chars)")
        print(f"\n💡 AI Reply:")
        print("-" * 60)
        print(content[:500] + ("..." if len(content) > 500 else ""))
        print("-" * 60)
        return 0
    else:
        error = response.get('error', 'Unknown error')
        print(f"\n❌ Failed: {error}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
