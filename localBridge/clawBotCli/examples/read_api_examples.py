#!/usr/bin/env python3
"""Example migrated from legacy read API test flows."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🧪 Read API examples via clawbot")
    print("=" * 60)

    tweets = client.x.timeline.list_timeline_tweets()
    print(f"Timeline tweets fetched: {len(tweets)}")

    first = client.x.timeline.get_first_timeline_tweet()
    if first:
        print(f"First tweet id: {first.id}")
        detail = client.x.tweets.get(first.id)
        print(f"Detailed tweet text: {detail.text}")

    user = client.x.users.get("elonmusk")
    print(f"User: @{user.screen_name} / {user.name}")

    results = client.x.search.search_tweets("AI", count=5)
    print(f"Search results: {len(results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
