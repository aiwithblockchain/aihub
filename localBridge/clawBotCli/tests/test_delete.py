#!/usr/bin/env python3
"""
Test Delete Tweet API
测试场景 8: 删除测试
"""
import sys
import json
from utils.api_client import APIClient


def test_delete_tweet():
    """Test DELETE /api/v1/x/mytweets"""
    print("\n" + "="*60)
    print("Testing: DELETE /api/v1/x/mytweets")
    print("="*60)
    print("⚠️  DANGER: This will permanently delete a tweet from your account!")
    print("⚠️  This action CANNOT be undone!")
    print("="*60)

    # Ask user to provide tweet ID
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
    confirm = input("\nAre you ABSOLUTELY SURE? Type 'DELETE' to confirm: ").strip()

    if confirm != "DELETE":
        print("⏭️  Cancelled - Tweet NOT deleted")
        return True

    client = APIClient()
    response = client.delete_tweet(tweet_id)

    print(json.dumps(response, indent=2, ensure_ascii=False)[:300] + "...")

    if 'data' in response or 'delete_tweet' in str(response) or 'ok' in response:
        print("✅ Tweet deleted successfully")
        print(f"   Verify on X that tweet {tweet_id} is gone")
        return True
    elif 'error' in response:
        print(f"❌ Delete failed: {response['error']}")
        return False
    else:
        print("❌ Delete failed: Unknown response format")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing Delete Tweet API (Scenario 8)")
    print("="*60)

    results = []
    results.append(("Delete Tweet", test_delete_tweet()))

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
