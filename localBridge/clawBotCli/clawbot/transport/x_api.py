"""Raw REST mappings for X/Twitter operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import BaseApiTransport


class XApiTransport(BaseApiTransport):
    def get_docs_raw(self) -> Dict[Any, Any] | List[Dict[Any, Any]]:
        return self.request_json("GET", "/api/v1/x/docs")

    def get_status_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/x/status")

    def get_instances_raw(self) -> Dict[Any, Any] | List[Dict[Any, Any]]:
        return self.request_json("GET", "/api/v1/x/instances")

    def get_basic_info_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/x/basic_info")

    def get_timeline_raw(self, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        params = {"tabId": tab_id} if tab_id else {}
        return self.request_json("GET", "/api/v1/x/timeline", params=params)

    def get_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> Dict[Any, Any]:
        params = {"tweetId": tweet_id}
        if tab_id:
            params["tabId"] = tab_id
        if instance_id:
            params["instanceId"] = instance_id
        return self.request_json("GET", "/api/v1/x/tweets", params=params)

    def get_tweet_replies_raw(self, tweet_id: str, cursor: Optional[str] = None, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> Dict[Any, Any]:
        params = {}
        if cursor:
            params["cursor"] = cursor
        if tab_id:
            params["tabId"] = tab_id
        if instance_id:
            params["instanceId"] = instance_id
        return self.request_json("GET", f"/api/v1/x/tweets/{tweet_id}/replies", params=params)

    def get_user_profile_raw(self, screen_name: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        params = {"screenName": screen_name}
        if tab_id:
            params["tabId"] = tab_id
        return self.request_json("GET", "/api/v1/x/users", params=params)

    def search_raw(self, query: str, cursor: Optional[str] = None, count: int = 20, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        params = {"query": query, "count": count}
        if cursor:
            params["cursor"] = cursor
        if tab_id:
            params["tabId"] = tab_id
        return self.request_json("GET", "/api/v1/x/search", params=params)

    def get_user_tweets_raw(self, user_id: str, cursor: Optional[str] = None, count: int = 20, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        params = {"userId": user_id, "count": count}
        if cursor:
            params["cursor"] = cursor
        if tab_id:
            params["tabId"] = tab_id
        return self.request_json("GET", "/api/v1/x/user_tweets", params=params)

    def create_tweet_raw(self, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        payload = {"text": text}
        if media_ids:
            payload["media_ids"] = media_ids
        return self.request_json("POST", "/api/v1/x/tweets", json=payload)

    def create_reply_raw(self, tweet_id: str, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id, "text": text}
        if media_ids:
            payload["media_ids"] = media_ids
        return self.request_json("POST", "/api/v1/x/replies", json=payload)

    def like_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/likes", json=payload)

    def unlike_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/unlikes", json=payload)

    def retweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/retweets", json=payload)

    def unretweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/unretweets", json=payload)

    def bookmark_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/bookmarks", json=payload)

    def unbookmark_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/unbookmarks", json=payload)

    def follow_user_raw(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"userId": user_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/follows", json=payload)

    def unfollow_user_raw(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"userId": user_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/api/v1/x/unfollows", json=payload)

    def delete_tweet_raw(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"tweetId": tweet_id}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("DELETE", "/api/v1/x/mytweets", json=payload)

    def open_tab_raw(self, path: str = "home") -> Dict[Any, Any]:
        return self.request_json("POST", "/tweetclaw/open-tab", json={"path": path})

    def close_tab_raw(self, tab_id: int) -> Dict[Any, Any]:
        return self.request_json("POST", "/tweetclaw/close-tab", json={"tabId": tab_id})

    def navigate_tab_raw(self, path: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        payload = {"path": path}
        if tab_id:
            payload["tabId"] = tab_id
        return self.request_json("POST", "/tweetclaw/navigate-tab", json=payload)
