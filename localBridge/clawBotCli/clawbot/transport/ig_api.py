"""Raw REST mappings for Instagram (igClaw) operations."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .base import BaseApiTransport


class IgApiTransport(BaseApiTransport):
    def get_status_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/status")

    def get_account_info_raw(self) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/account")

    def get_feed_raw(self, max_id: Optional[str] = None) -> Dict[Any, Any]:
        params = {}
        if max_id:
            params["maxId"] = max_id
        return self.request_json("GET", "/api/v1/ig/feed", params=params)

    def get_media_info_raw(self, shortcode: str) -> Dict[Any, Any]:
        return self.request_json("GET", "/api/v1/ig/media", params={"shortcode": shortcode})

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

    def get_media_comments_raw(
        self,
        media_id: str,
        min_id: Optional[str] = None,
        sort_order: Optional[str] = "popular",
        can_support_threading: bool = True,
        permalink_enabled: bool = False,
    ) -> Dict[Any, Any]:
        """获取媒体评论列表

        Args:
            media_id: 媒体 ID
            min_id: 分页游标（JSON 编码）
            sort_order: 排序方式 ('popular' 或 'chronological')
            can_support_threading: 是否支持评论回复
            permalink_enabled: 是否启用永久链接

        Returns:
            评论列表和分页信息
        """
        params = {
            "mediaId": media_id,
            "sortOrder": sort_order,
            "canSupportThreading": str(can_support_threading).lower(),
            "permalinkEnabled": str(permalink_enabled).lower(),
        }
        if min_id:
            params["minId"] = min_id

        return self.request_json("GET", "/api/v1/ig/media/comments", params=params)

    # ============ 高级封装方法 ============

    def get_self_info(self) -> Dict[Any, Any]:
        """获取当前用户信息"""
        return self.get_account_info_raw()

    def get_user_info(self, user_id: str) -> Dict[Any, Any]:
        """获取用户信息"""
        return self.get_user_info_raw(user_id)

    def search_user(self, username: str) -> Dict[Any, Any]:
        """搜索用户"""
        return self.search_user_raw(username)

    def get_feed(self, max_id: Optional[str] = None) -> Dict[Any, Any]:
        """获取首页 Feed"""
        return self.get_feed_raw(max_id)

    def get_media_info(self, shortcode: str) -> Dict[Any, Any]:
        """获取媒体详情"""
        return self.get_media_info_raw(shortcode)

    def like_media(self, media_id: str) -> Dict[Any, Any]:
        """点赞媒体"""
        return self.like_media_raw(media_id)

    def unlike_media(self, media_id: str) -> Dict[Any, Any]:
        """取消点赞"""
        return self.unlike_media_raw(media_id)

    def follow_user(self, user_id: str) -> Dict[Any, Any]:
        """关注用户"""
        return self.follow_user_raw(user_id)

    def unfollow_user(self, user_id: str) -> Dict[Any, Any]:
        """取消关注"""
        return self.unfollow_user_raw(user_id)

    def post_comment(self, media_id: str, text: str, replied_to_comment_id: Optional[str] = None) -> Dict[Any, Any]:
        """发布评论"""
        return self.post_comment_raw(media_id, text, replied_to_comment_id)

    def get_media_comments(
        self,
        media_id: str,
        min_id: Optional[str] = None,
        sort_order: Optional[str] = "popular",
        can_support_threading: bool = True,
        permalink_enabled: bool = False,
    ) -> Dict[Any, Any]:
        """获取媒体评论列表"""
        return self.get_media_comments_raw(
            media_id=media_id,
            min_id=min_id,
            sort_order=sort_order,
            can_support_threading=can_support_threading,
            permalink_enabled=permalink_enabled,
        )
