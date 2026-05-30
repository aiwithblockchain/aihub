"""Raw REST mappings for XHS (Xiaohongshu) operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import BaseApiTransport


class XhsApiTransport(BaseApiTransport):
    def get_account_info_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/xhs/account")

    def get_homefeed_raw(self, cursor_score: Optional[str] = None) -> Dict[Any, Any]:
        params = {}
        if cursor_score:
            params["cursor_score"] = cursor_score
        return self.request_json("GET", "/api/v1/xhs/homefeed", params=params)

    def get_feed_raw(self, note_id: str, xsec_token: Optional[str] = None, xsec_source: Optional[str] = None) -> Dict[Any, Any]:
        params = {"note_id": note_id}
        if xsec_token:
            params["xsec_token"] = xsec_token
        if xsec_source:
            params["xsec_source"] = xsec_source
        return self.request_json("GET", "/api/v1/xhs/feed", params=params)

    def search_raw(self, keyword: str, cursor: Optional[str] = None, page_size: int = 20) -> Dict[Any, Any]:
        payload = {"keyword": keyword, "page_size": page_size}
        if cursor:
            payload["cursor"] = cursor
        return self.request_json("POST", "/api/v1/xhs/search", json=payload)

    def get_user_notes_raw(self, user_id: str, cursor: Optional[str] = None, xsec_token: Optional[str] = None, xsec_source: Optional[str] = None) -> Dict[Any, Any]:
        params = {"user_id": user_id}
        if cursor:
            params["cursor"] = cursor
        if xsec_token:
            params["xsec_token"] = xsec_token
        if xsec_source:
            params["xsec_source"] = xsec_source
        return self.request_json("GET", "/api/v1/xhs/user_notes", params=params)

    def publish_note_raw(self, title: str, desc: str, images: List[Dict[str, Any]],
                        privacy_type: int = 0, topics: Optional[List[Dict[str, Any]]] = None) -> Dict[Any, Any]:
        payload = {
            "title": title,
            "desc": desc,
            "images": images,
            "privacy_type": privacy_type,
            "topics": topics or []
        }
        return self.request_json("POST", "/api/v1/xhs/publish", json=payload)

    def get_note_comments_raw(self, note_id: str, cursor: Optional[str] = None, xsec_token: Optional[str] = None) -> Dict[Any, Any]:
        params = {"note_id": note_id}
        if cursor:
            params["cursor"] = cursor
        if xsec_token:
            params["xsec_token"] = xsec_token
        return self.request_json("GET", "/api/v1/xhs/comments", params=params)

    def get_user_info_raw(self, user_id: str) -> Dict[Any, Any]:
        params = {"user_id": user_id}
        return self.request_json("GET", "/api/v1/xhs/user_info", params=params)

    def search_topics_raw(self, keyword: str) -> Dict[Any, Any]:
        params = {"keyword": keyword}
        return self.request_json("GET", "/api/v1/xhs/topics", params=params)

    def get_notifications_raw(self, notif_type: str, cursor: Optional[str] = None) -> Dict[Any, Any]:
        params = {"notification_type": notif_type}
        if cursor:
            params["cursor"] = cursor
        return self.request_json("GET", "/api/v1/xhs/notifications", params=params)

    def get_published_notes_raw(self, cursor: Optional[str] = None) -> Dict[Any, Any]:
        params = {}
        if cursor:
            params["page"] = cursor
        return self.request_json("GET", "/api/v1/xhs/published_notes", params=params)

    def search_filter_raw(self, keyword: str, search_id: Optional[str] = None) -> Dict[Any, Any]:
        params = {"keyword": keyword}
        if search_id:
            params["search_id"] = search_id
        return self.request_json("GET", "/api/v1/xhs/search_filter", params=params)

    def publish_video_note_raw(
        self,
        title: str,
        desc: str,
        video: Dict[str, Any],
        privacy_type: int = 0,
    ) -> Dict[Any, Any]:
        payload = {
            "title": title,
            "desc": desc,
            "video": video,
            "privacy_type": privacy_type,
        }
        return self.request_json("POST", "/api/v1/xhs/publish_video", json=payload)

    def post_comment_raw(
        self,
        note_id: str,
        content: str,
        target_comment_id: Optional[str] = None,
        at_users: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[Any, Any]:
        payload = {
            "note_id": note_id,
            "content": content,
            "at_users": at_users or [],
        }
        if target_comment_id:
            payload["target_comment_id"] = target_comment_id
        return self.request_json("POST", "/api/v1/xhs/comment", json=payload)

    def search_users_raw(self, keyword: str, page: int = 1, rows: int = 30) -> Dict[Any, Any]:
        params = {"keyword": keyword, "page": str(page), "rows": str(rows)}
        return self.request_json("GET", "/api/v1/xhs/search_users", params=params)

    def get_intimacy_list_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/xhs/intimacy_list")

    def like_note_raw(self, note_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/like", json={"note_id": note_id})
