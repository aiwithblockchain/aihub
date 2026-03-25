#!/usr/bin/env python3
"""
Test AI New Conversation API
Usage: python3 test_ai_new_conversation.py [platform]
Example: python3 test_ai_new_conversation.py chatgpt
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

    print(f"\n🆕 Testing: POST /api/v1/ai/new_conversation")
    print("="*60)
    print(f"Platform: {platform}")
    print("="*60)

    client = APIClient()
    response = client.new_ai_conversation(platform=platform)

    print("\n📋 Response:")
    print(json.dumps(response, indent=2, ensure_ascii=False))

    if response.get('success'):
        print(f"\n✅ Success: New conversation created")
        if 'taskId' in response:
            print(f"Task ID: {response['taskId']}")
        return 0
    else:
        error = response.get('error', 'Unknown error')
        print(f"\n❌ Failed: {error}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
