#!/usr/bin/env python3
"""Example migrated from legacy write API tests."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🧪 Write API examples via clawbot")
    print("=" * 60)
    print("⚠️  These examples perform real actions on your X account!")

    text = input("Enter tweet text (default: Test from clawbot): ").strip() or "Test from clawbot"
    confirm = input("Create tweet? (yes/no): ").strip().lower()
    if confirm == "yes":
        result = client.x.actions.create_tweet(text)
        print(result)

    tweet_id = input("Enter tweet ID to like (or press Enter to skip): ").strip()
    if tweet_id:
        print(client.x.actions.like(tweet_id))

    tweet_id = input("Enter tweet ID to retweet (or press Enter to skip): ").strip()
    if tweet_id:
        print(client.x.actions.retweet(tweet_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
