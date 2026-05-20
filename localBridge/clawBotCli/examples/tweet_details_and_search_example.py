#!/usr/bin/env python3
"""Example focused on tweet details and search flows via clawbot."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🧪 Tweet detail and search example")
    print("=" * 60)

    first = client.x.timeline.get_first_timeline_tweet()
    if first and first.id:
        detail = client.x.tweets.get(first.id)
        replies = client.x.tweets.get_tweet_replies(first.id)
        print(f"Tweet id: {detail.id}")
        print(f"Tweet text: {detail.text}")
        print(f"Replies fetched: {len(replies)}")

    user = client.x.users.get("elonmusk")
    print(f"User profile: @{user.screen_name}")

    tweets = client.x.search.search_tweets("AI", count=5)
    print(f"Search tweet count: {len(tweets)}")

    first_user = client.x.search.search_first_user("AI")
    if first_user:
        print(f"First search user: @{first_user.screen_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
