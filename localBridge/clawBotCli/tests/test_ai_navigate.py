#!/usr/bin/env python3
"""
Test AI Navigate API
Usage: python3 test_ai_navigate.py [platform]
Example: python3 test_ai_navigate.py chatgpt
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def main():
    # Parse arguments
    platform = sys.argv[1] if len(sys.argv) > 1 else 'chatgpt'

    print(f"\n🧭 Testing: POST /api/v1/ai/navigate")
    print("="*60)
    print(f"Platform: {platform}")
    print("="*60)

    client = ClawBotClient()
    status = client.ai.status.get_status()
    platforms = status.get('platforms', {}) if isinstance(status, dict) else {}
    platform_status = platforms.get(platform, {}) if isinstance(platforms, dict) else {}

    if not platform_status.get('hasTab'):
        print("\n⛔ Blocked: No open tab found for target platform")
        print("Please open and log into the target AI platform, then rerun this test.")
        return 2

    result = client.ai.navigation.navigate(platform=platform)

    print("\n📋 Response:")
    print(json.dumps(result.raw, indent=2, ensure_ascii=False))

    if result.success:
        tabs_navigated = result.raw.get('tabsNavigated', 0)
        print(f"\n✅ Success: Navigated {tabs_navigated} tab(s)")
        return 0
    else:
        error = result.message or 'Unknown error'
        print(f"\n❌ Failed: {error}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
