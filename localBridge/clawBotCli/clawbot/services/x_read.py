"""Service layer for X read operations."""

from __future__ import annotations

from typing import List, Optional, Tuple

from clawbot.domain.models import XTweet, XUser
from clawbot.domain.x_parsers import (
    extract_first_timeline_tweet,
    extract_focal_tweet,
    extract_pinned_tweet_id_from_profile,
    extract_search_tweets_and_users,
    extract_timeline_tweets,
    extract_tweet_detail_replies,
    parse_tweet_result,
    parse_user_profile,
)
from clawbot.transport.x_api import XApiTransport


class XReadService:
    def __init__(self, transport: XApiTransport):
        self.transport = transport

    def get_timeline_raw(self, tab_id: Optional[int] = None):
        return self.transport.get_timeline_raw(tab_id=tab_id)

    def list_timeline_tweets(self, tab_id: Optional[int] = None) -> List[XTweet]:
        return extract_timeline_tweets(self.get_timeline_raw(tab_id=tab_id))

    def get_first_timeline_tweet(self, tab_id: Optional[int] = None) -> Optional[XTweet]:
        return extract_first_timeline_tweet(self.get_timeline_raw(tab_id=tab_id))

    def get_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return self.transport.get_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id)

    def get_tweet(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> XTweet:
        raw = self.get_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id)
        focal_tweet = extract_focal_tweet(raw, tweet_id)
        if focal_tweet:
            return focal_tweet
        return XTweet(id=tweet_id, raw=raw)

    def get_tweet_replies(self, tweet_id: str, cursor: Optional[str] = None, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> List[XTweet]:
        raw = self.transport.get_tweet_replies_raw(tweet_id=tweet_id, cursor=cursor, tab_id=tab_id, instance_id=instance_id)
        return extract_tweet_detail_replies(raw, tweet_id=tweet_id)

    def get_user(self, screen_name: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> XUser:
        return parse_user_profile(self.transport.get_user_profile_raw(screen_name=screen_name, tab_id=tab_id, instance_id=instance_id))

    def get_pinned_tweet(self, screen_name: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> Optional[XTweet]:
        profile_raw = self.transport.get_user_profile_raw(screen_name=screen_name, tab_id=tab_id, instance_id=instance_id)
        pinned_tweet_id = extract_pinned_tweet_id_from_profile(profile_raw)
        if not pinned_tweet_id:
            return None
        return self.get_tweet(pinned_tweet_id, tab_id=tab_id, instance_id=instance_id)

    def search(self, query: str, count: int = 20, cursor: Optional[str] = None, tab_id: Optional[int] = None) -> Tuple[List[XTweet], List[XUser]]:
        raw = self.transport.search_raw(query=query, count=count, cursor=cursor, tab_id=tab_id)
        return extract_search_tweets_and_users(raw)

    def search_tweets(self, query: str, count: int = 20, cursor: Optional[str] = None, tab_id: Optional[int] = None) -> List[XTweet]:
        tweets, _ = self.search(query=query, count=count, cursor=cursor, tab_id=tab_id)
        return tweets

    def search_first_tweet(self, query: str, tab_id: Optional[int] = None) -> Optional[XTweet]:
        tweets = self.search_tweets(query=query, count=5, tab_id=tab_id)
        return tweets[0] if tweets else None

    def search_first_user(self, query: str, tab_id: Optional[int] = None) -> Optional[XUser]:
        _, users = self.search(query=query, count=5, tab_id=tab_id)
        return users[0] if users else None

    def get_user_tweets(self, user_id: str, count: int = 20, cursor: Optional[str] = None, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> List[XTweet]:
        raw = self.transport.get_user_tweets_raw(user_id=user_id, count=count, cursor=cursor, tab_id=tab_id, instance_id=instance_id)
        data = raw.get("data", {}) if isinstance(raw, dict) else {}
        if isinstance(data, dict) and "data" in data:
            data = data["data"]

        tweets: List[XTweet] = []
        user_result = data.get("user", {}).get("result", {})
        timeline = user_result.get("timeline", {}).get("timeline", {})
        instructions = timeline.get("instructions", [])

        for instruction in instructions:
            if instruction.get("type") != "TimelineAddEntries":
                continue
            for entry in instruction.get("entries", []):
                tweet_result = (
                    entry.get("content", {})
                    .get("itemContent", {})
                    .get("tweet_results", {})
                    .get("result", {})
                )
                if tweet_result:
                    tweets.append(parse_tweet_result(tweet_result))
        return tweets
