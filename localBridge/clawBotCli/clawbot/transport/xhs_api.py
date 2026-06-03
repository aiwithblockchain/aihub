"""Raw REST mappings for XHS (Xiaohongshu) operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import BaseApiTransport


class XhsApiTransport(BaseApiTransport):
    def get_account_info_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/xhs/account")

    def get_homefeed_raw(
        self,
        cursor_score: Optional[str] = None,
        category: Optional[str] = None,
        refresh_type: Optional[int] = None,
        num: Optional[int] = None,
        note_index: Optional[int] = None,
        unread_begin_note_id: Optional[str] = None,
        unread_end_note_id: Optional[str] = None,
        unread_note_count: Optional[int] = None,
        search_key: Optional[str] = None,
        need_num: Optional[int] = None,
        image_formats: Optional[List[str]] = None,
        need_filter_image: Optional[bool] = None,
    ) -> Dict[Any, Any]:
        params: Dict[str, Any] = {}
        if cursor_score is not None:
            params["cursor_score"] = cursor_score
        if category is not None:
            params["category"] = category
        if refresh_type is not None:
            params["refresh_type"] = refresh_type
        if num is not None:
            params["num"] = num
        if note_index is not None:
            params["note_index"] = note_index
        if unread_begin_note_id is not None:
            params["unread_begin_note_id"] = unread_begin_note_id
        if unread_end_note_id is not None:
            params["unread_end_note_id"] = unread_end_note_id
        if unread_note_count is not None:
            params["unread_note_count"] = unread_note_count
        if search_key is not None:
            params["search_key"] = search_key
        if need_num is not None:
            params["need_num"] = need_num
        if image_formats is not None:
            params["image_formats"] = image_formats
        if need_filter_image is not None:
            params["need_filter_image"] = need_filter_image
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
                        privacy_type: int = 0,
                        privacy_user_ids: Optional[List[str]] = None,
                        topics: Optional[List[Dict[str, Any]]] = None,
                        scheduled_publish_time: Optional[int] = None) -> Dict[Any, Any]:
        payload: Dict[str, Any] = {
            "title": title,
            "desc": desc,
            "images": images,
            "privacy_type": privacy_type,
            "privacy_user_ids": privacy_user_ids or [],
            "topics": topics or [],
        }
        if scheduled_publish_time is not None:
            payload["scheduled_publish_time"] = scheduled_publish_time
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
        privacy_user_ids: Optional[List[str]] = None,
        topics: Optional[List[Dict[str, Any]]] = None,
        scheduled_publish_time: Optional[int] = None,
        cover: Optional[Dict[str, Any]] = None,
    ) -> Dict[Any, Any]:
        payload: Dict[str, Any] = {
            "title": title,
            "desc": desc,
            "video": video,
            "privacy_type": privacy_type,
            "privacy_user_ids": privacy_user_ids or [],
            "topics": topics or [],
        }
        if scheduled_publish_time is not None:
            payload["scheduled_publish_time"] = scheduled_publish_time
        if cover is not None:
            payload["cover"] = cover
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
        return self.request_json("POST", "/api/v1/xhs/like", json={"note_oid": note_id})

    def unlike_note_raw(self, note_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/unlike", json={"note_oid": note_id})

    def follow_user_raw(self, target_user_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/follow", json={"target_user_id": target_user_id})

    def unfollow_user_raw(self, target_user_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/unfollow", json={"target_user_id": target_user_id})

    def collect_note_raw(self, note_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/collect", json={"note_id": note_id})

    def delete_note_raw(self, note_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/delete_note", json={"note_id": note_id})

    def delete_comment_raw(self, note_id: str, comment_id: str) -> Dict[Any, Any]:
        return self.request_json("POST", "/api/v1/xhs/delete_comment", json={"note_id": note_id, "comment_id": comment_id})

    def get_friend_fans_raw(self, cursor: str = '', size: int = 20) -> Dict[Any, Any]:
        params: Dict[str, Any] = {"size": str(size)}
        if cursor:
            params["cursor"] = cursor
        return self.request_json("GET", "/api/v1/xhs/friend_fans", params=params)

    def create_collection_raw(self, name: str, desc: str = '', cover: Optional[Dict[str, Any]] = None) -> Dict[Any, Any]:
        payload: Dict[str, Any] = {"name": name, "desc": desc}
        if cover is not None:
            payload["cover"] = cover
        return self.request_json("POST", "/api/v1/xhs/collection/create", json=payload)

    def list_collections_raw(self, cursor: str = '') -> Dict[Any, Any]:
        payload: Dict[str, Any] = {"cursor": cursor}
        return self.request_json("POST", "/api/v1/xhs/collection/list", json=payload)

    def list_collection_notes_raw(self, collection_id: str) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/xhs/collection/notes", params={"collection_id": collection_id})

    def update_collection_raw(self, collection_id: str, name: str, desc: str = '', cover: Optional[Dict[str, Any]] = None) -> Dict[Any, Any]:
        payload: Dict[str, Any] = {"collection_id": collection_id, "name": name, "desc": desc}
        if cover is not None:
            payload["cover"] = cover
        return self.request_json("POST", "/api/v1/xhs/collection/update", json=payload)
