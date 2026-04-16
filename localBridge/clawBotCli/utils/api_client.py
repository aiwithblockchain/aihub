"""Backward-compatible wrapper around the new clawbot library.

Deprecated: new code should import `ClawBotClient` from `clawbot` directly.
This module is kept only as a transition layer for legacy scripts/tests.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from clawbot import ClawBotClient
from clawbot.config import API_BASE_URL, API_TIMEOUT
from clawbot.domain.models import MediaUploadResult
from clawbot.services.media import MediaService


class APIClient:
    """Compatibility facade preserving the legacy APIClient surface."""

    def __init__(self, base_url: str = API_BASE_URL, timeout: int = API_TIMEOUT):
        self._client = ClawBotClient(base_url=base_url, timeout=timeout)
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, **kwargs) -> Dict[Any, Any]:
        if method == "GET" and path == "/api/v1/x/docs":
            return self._client.x_status.get_docs_raw()
        raise NotImplementedError(f"Legacy _request passthrough not implemented for {method} {path}")

    def get_x_status(self) -> Dict[Any, Any]:
        return self._client.x_transport.get_status_raw()

    def get_instances(self) -> Dict[Any, Any] | List[Dict[Any, Any]]:
        return self._client.x_transport.get_instances_raw()

    def get_basic_info(self) -> Dict[Any, Any]:
        return self._client.x_transport.get_basic_info_raw()

    def get_timeline(self, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.get_timeline_raw(tab_id=tab_id)

    def get_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.get_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def get_tweet_replies(self, tweet_id: str, cursor: Optional[str] = None, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.get_tweet_replies_raw(tweet_id=tweet_id, cursor=cursor, tab_id=tab_id)

    def get_user_profile(self, screen_name: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.get_user_profile_raw(screen_name=screen_name, tab_id=tab_id)

    def search_timeline(self, query: str, cursor: Optional[str] = None, count: int = 20, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.search_raw(query=query, cursor=cursor, count=count, tab_id=tab_id)

    def create_tweet(self, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        return self._client.x_transport.create_tweet_raw(text=text, media_ids=media_ids)

    def create_reply(self, tweet_id: str, text: str, media_ids: Optional[List[str]] = None) -> Dict[Any, Any]:
        return self._client.x_transport.create_reply_raw(tweet_id=tweet_id, text=text, media_ids=media_ids)

    def like_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.like_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def unlike_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.unlike_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def retweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.retweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def unretweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.unretweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def bookmark_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.bookmark_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def unbookmark_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.unbookmark_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def follow_user(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.follow_user_raw(user_id=user_id, tab_id=tab_id)

    def unfollow_user(self, user_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.unfollow_user_raw(user_id=user_id, tab_id=tab_id)

    def delete_tweet(self, tweet_id: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.delete_tweet_raw(tweet_id=tweet_id, tab_id=tab_id)

    def open_tab(self, path: str = "home") -> Dict[Any, Any]:
        return self._client.x_transport.open_tab_raw(path=path)

    def close_tab(self, tab_id: int) -> Dict[Any, Any]:
        return self._client.x_transport.close_tab_raw(tab_id=tab_id)

    def navigate_tab(self, path: str, tab_id: Optional[int] = None) -> Dict[Any, Any]:
        return self._client.x_transport.navigate_tab_raw(path=path, tab_id=tab_id)

    def get_ai_status(self) -> Dict[Any, Any]:
        return self._client.ai_transport.get_status_raw()

    def send_ai_message(self, platform: str, prompt: str, conversation_id: Optional[str] = None) -> Dict[Any, Any]:
        return self._client.ai_transport.send_message_raw(platform=platform, prompt=prompt, conversation_id=conversation_id)

    def new_ai_conversation(self, platform: str) -> Dict[Any, Any]:
        return self._client.ai_transport.new_conversation_raw(platform)

    def navigate_ai_platform(self, platform: str) -> Dict[Any, Any]:
        return self._client.ai_transport.navigate_platform_raw(platform)


class MediaUploadTask:
    """Backward-compatible media upload wrapper."""

    def __init__(self, task_client, uploader, progress):
        self.task_client = task_client
        self.uploader = uploader
        self.progress = progress
        self._media_service = MediaService(task_client=self.task_client, actions=None, uploader=self.uploader, progress=self.progress)

    def upload_video(self, video_path: str, client_name: str = "tweetClaw", instance_id: str = None, tab_id: int = None) -> str:
        result: MediaUploadResult = self._media_service.upload(
            video_path,
            client_name=client_name,
            instance_id=instance_id,
            tab_id=tab_id,
        )
        return result.media_id
