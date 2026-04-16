#!/usr/bin/env python3
"""Integration smoke tests for tweet details and search flows."""

from clawbot import ClawBotClient


def test_tweet_detail_smoke() -> None:
    client = ClawBotClient()
    first = client.x.timeline.get_first_timeline_tweet()
    if first and first.id:
        detail = client.x.tweets.get(first.id)
        assert detail is not None


def test_search_smoke() -> None:
    client = ClawBotClient()
    tweets = client.x.search.search_tweets("AI", count=1)
    assert isinstance(tweets, list)


if __name__ == "__main__":
    test_tweet_detail_smoke()
    test_search_smoke()
    print("Tweet/search integration smoke tests passed")
