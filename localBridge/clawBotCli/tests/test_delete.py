#!/usr/bin/env python3
"""
Test Delete Tweet API
测试场景 8: 删除测试
"""
import sys
import os
import json
import argparse

# Add parent directory to path to import utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_delete_tweet(tweet_id=None, force=False):
    """Test DELETE /api/v1/x/mytweets"""
    print("\n" + "="*60)
    print("Testing: DELETE /api/v1/x/mytweets")
    print("="*60)
    print("⚠️  DANGER: This will permanently delete a tweet from your account!")
    print("⚠️  This action CANNOT be undone!")
    print("="*60)

    # If tweet_id not provided via argument, ask user to provide it
    if not tweet_id:
        print("\n建议流程:")
        print("1. 先使用 test_publish.py 创建一条测试推文")
        print("2. 记录返回的 tweet_id")
        print("3. 在此处输入该 tweet_id 进行删除测试")
        print()

        tweet_id = input("Enter tweet ID to delete (or press Enter to skip): ").strip()
        if not tweet_id:
            print("⏭️  Skipped")
            return True

    print(f"\n⚠️  You are about to DELETE tweet: {tweet_id}")
    print(f"   View at: https://x.com/i/web/status/{tweet_id}")

    if not force:
        confirm = input("\nAre you ABSOLUTELY SURE? Type 'DELETE' to confirm: ").strip()

        if confirm != "DELETE":
            print("⏭️  Cancelled - Tweet NOT deleted")
            return True
    else:
        print("\n⚠️  --force flag detected, skipping confirmation")

    client = ClawBotClient()
    result = client.x.actions.delete_tweet(tweet_id)

    print(json.dumps(result.raw, indent=2, ensure_ascii=False)[:300] + "...")

    if result.success:
        print("✅ Tweet deleted successfully")
        print(f"   Verify on X that tweet {tweet_id} is gone")
        return True
    else:
        error = result.message or 'Unknown error'
        print(f"❌ Delete failed: {error}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test Delete Tweet API')
    parser.add_argument('--tweet-id', type=str, help='Tweet ID to delete')
    parser.add_argument('--force', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    print("\n🧪 Testing Delete Tweet API (Scenario 8)")
    print("="*60)

    results = []
    results.append(("Delete Tweet", test_delete_tweet(args.tweet_id, args.force)))

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
