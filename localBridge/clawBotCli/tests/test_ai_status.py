#!/usr/bin/env python3
"""
Test AI Status API
Usage: python3 test_ai_status.py
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.api_client import APIClient

def main():
    print("\n🔍 Testing: GET /api/v1/ai/status")
    print("="*60)

    client = APIClient()
    response = client.get_ai_status()

    print("\n📋 Response:")
    print(json.dumps(response, indent=2, ensure_ascii=False))

    if 'tabs' in response:
        tab_count = len(response['tabs'])
        print(f"\n✅ Success: Found {tab_count} AI tab(s)")

        # Show platform details
        if 'platforms' in response:
            print("\n📊 Platform Status:")
            for platform, info in response['platforms'].items():
                status = "✓" if info.get('hasTab') else "✗"
                logged_in = "logged in" if info.get('isLoggedIn') else "not logged in"
                print(f"  {status} {platform}: {logged_in}")

        return 0
    else:
        print("\n❌ Failed: Unexpected response format")
        return 1

if __name__ == '__main__':
    sys.exit(main())
