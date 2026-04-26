#!/usr/bin/env python3
"""
Test Read APIs (Timeline, Tweet, User Profile, Search)
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clawbot import ClawBotClient


def test_timeline():
    """Test GET /api/v1/x/timeline"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/timeline")
    print("="*60)

    client = ClawBotClient()
    tweets = client.x.timeline.list_timeline_tweets()

    print(f"Found {len(tweets)} tweets")
    if tweets:
        print(f"First tweet: {tweets[0].text[:100] if tweets[0].text else 'N/A'}...")
        print("✅ Timeline fetched successfully")
        return True
    else:
        print("⚠️  No tweets found")
        return True


def test_get_tweet():
    """Test GET /api/v1/x/tweets?tweetId=..."""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/tweets?tweetId=...")
    print("="*60)

    # 需要用户提供真实的 tweet ID
    tweet_id = input("Enter a tweet ID to test (or press Enter to skip): ").strip()
    if not tweet_id:
        print("⏭️  Skipped")
        return True

    client = ClawBotClient()
    tweet = client.x.tweets.get_tweet(tweet_id)

    if tweet:
        print(f"✅ Tweet fetched: {tweet.text[:100] if tweet.text else 'N/A'}...")
        return True
    else:
        print("❌ Failed to fetch tweet")
        return False


def test_user_profile():
    """Test GET /api/v1/x/users"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/users")
    print("="*60)

    screen_name = input("Enter a screen name to test (default: elonmusk): ").strip()
    if not screen_name:
        screen_name = "elonmusk"

    client = ClawBotClient()
    user = client.x.users.get_user(screen_name)

    if user:
        print(f"✅ User profile fetched: @{user.screen_name} - {user.name}")
        return True
    else:
        print("❌ Failed to fetch user profile")
        return False


def test_search():
    """Test GET /api/v1/x/search"""
    print("\n" + "="*60)
    print("Testing: GET /api/v1/x/search")
    print("="*60)

    query = input("Enter search query (default: AI): ").strip()
    if not query:
        query = "AI"

    client = ClawBotClient()
    tweets, users = client.x.search.search(query, count=5)

    print(f"✅ Search completed: found {len(tweets)} tweets, {len(users)} users")
    return True


if __name__ == "__main__":
    print("\n🧪 Testing Read APIs")
    print("="*60)

    results = []
    results.append(("Timeline", test_timeline()))
    results.append(("Get Tweet", test_get_tweet()))
    results.append(("User Profile", test_user_profile()))
    results.append(("Search", test_search()))

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
