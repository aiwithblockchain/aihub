"""Raw REST mappings for Instagram (igClaw) operations."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .base import BaseApiTransport


class IgApiTransport(BaseApiTransport):
    def get_status_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/status")

    def get_account_info_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/account")

    def get_user_info_raw(self, user_id: str) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/users", params={"userId": user_id})

    def search_user_raw(self, username: str) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/users/search", params={"username": username})

    def like_media_raw(self, media_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ig/likes", json={"mediaId": media_id})

    def unlike_media_raw(self, media_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ig/unlikes", json={"mediaId": media_id})

    def follow_user_raw(self, user_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ig/follows", json={"userId": user_id})

    def unfollow_user_raw(self, user_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/ig/unfollows", json={"userId": user_id})

    def post_comment_raw(self, media_id: str, text: str, replied_to_comment_id: Optional[str] = None) -> Dict[Any, Any]:
        payload: Dict[str, Any] = {"mediaId": media_id, "text": text}
        if replied_to_comment_id:
            payload["repliedToCommentId"] = replied_to_comment_id
        return self.request_json("POST", "/api/v1/ig/comments", json=payload)
