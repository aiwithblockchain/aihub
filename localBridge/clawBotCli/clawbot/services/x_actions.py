"""Service layer for X write operations."""

from __future__ import annotations

from typing import List, Optional

from clawbot.domain.result import build_action_result
from clawbot.transport.x_api import XApiTransport


class XActionsService:
    def __init__(self, transport: XApiTransport):
        self.transport = transport

    def create_tweet(self, text: str, media_ids: Optional[List[str]] = None, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        raw = self.transport.create_tweet_raw(text=text, media_ids=media_ids, tab_id=tab_id, instance_id=instance_id)
        target_id = None
        data = raw.get("data", {}) if isinstance(raw, dict) else {}
        if isinstance(data, dict) and "data" in data:
            data = data["data"]
        if isinstance(data, dict):
            target_id = data.get("create_tweet", {}).get("tweet_results", {}).get("result", {}).get("rest_id")
        return build_action_result("create_tweet", raw, target_id=target_id)

    def reply(self, tweet_id: str, text: str, media_ids: Optional[List[str]] = None, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        raw = self.transport.create_reply_raw(tweet_id=tweet_id, text=text, media_ids=media_ids, tab_id=tab_id, instance_id=instance_id)
        return build_action_result("reply", raw, target_id=tweet_id)

    def like(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("like", self.transport.like_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def unlike(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("unlike", self.transport.unlike_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def retweet(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("retweet", self.transport.retweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def unretweet(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("unretweet", self.transport.unretweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def bookmark(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("bookmark", self.transport.bookmark_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def unbookmark(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("unbookmark", self.transport.unbookmark_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)

    def follow(self, user_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("follow", self.transport.follow_user_raw(user_id=user_id, tab_id=tab_id, instance_id=instance_id), target_id=user_id)

    def unfollow(self, user_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("unfollow", self.transport.unfollow_user_raw(user_id=user_id, tab_id=tab_id, instance_id=instance_id), target_id=user_id)

    def delete_tweet(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None):
        return build_action_result("delete_tweet", self.transport.delete_tweet_raw(tweet_id=tweet_id, tab_id=tab_id, instance_id=instance_id), target_id=tweet_id)
