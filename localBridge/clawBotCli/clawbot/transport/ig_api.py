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

    def delete_comment_raw(self, media_id: str, comment_id: str) -> Dict[Any, Any]:
        """删除评论

        Args:
            media_id: 媒体 ID
            comment_id: 评论 ID

        Returns:
            操作结果
        """
        return self.request_json(
            "POST",
            "/api/v1/ig/comments/delete",
            json={"mediaId": media_id, "commentId": comment_id}
        )

    def post_media_raw(
        self,
        image_base64: str,
        caption: str,
        mime_type: str = "image/jpeg",
        disable_comments: bool = False,
        share_to_threads: bool = True,
        location: Optional[Dict[str, Any]] = None,
    ) -> Dict[Any, Any]:
        """发布媒体

        Args:
            image_base64: 图片 base64（不含前缀）
            caption: 文案
            mime_type: MIME 类型
            disable_comments: 是否禁用评论
            share_to_threads: 是否分享到 Threads
            location: 位置信息（可选）

        Returns:
            媒体对象
        """
        payload: Dict[str, Any] = {
            "imageBase64": image_base64,
            "caption": caption,
            "mimeType": mime_type,
            "disableComments": disable_comments,
            "shareToThreads": share_to_threads,
        }
        if location:
            payload["location"] = location
        # 媒体发布需要较长时间（上传 + 配置），设置 90 秒超时
        return self.request_json("POST", "/api/v1/ig/media/post", json=payload, timeout=90)

    def post_video_raw(
        self,
        video_base64: str,
        caption: str,
        mime_type: str = "video/mp4",
        duration: int = 10000,
        width: int = 720,
        height: int = 1280,
        disable_comments: bool = False,
        share_to_threads: bool = True,
        thumbnail_base64: Optional[str] = None,
    ) -> Dict[Any, Any]:
        """发布视频

        Args:
            video_base64: 视频 base64（不含前缀）
            caption: 文案
            mime_type: MIME 类型
            duration: 视频时长（毫秒）
            width: 视频宽度
            height: 视频高度
            disable_comments: 是否禁用评论
            share_to_threads: 是否分享到 Threads
            thumbnail_base64: 封面图片 base64（不含前缀，可选）

        Returns:
            媒体对象
        """
        payload: Dict[str, Any] = {
            "videoBase64": video_base64,
            "caption": caption,
            "mimeType": mime_type,
            "videoDuration": duration,
            "videoWidth": width,
            "videoHeight": height,
            "disableComments": disable_comments,
            "shareToThreads": share_to_threads,
        }

        if thumbnail_base64:
            payload["thumbnailBase64"] = thumbnail_base64

        # 视频发布需要更长时间（上传 + 转码 + 配置），设置 180 秒超时
        return self.request_json("POST", "/api/v1/ig/media/post", json=payload, timeout=180)

    def delete_media_raw(self, media_id: str) -> Dict[Any, Any]:
        """删除媒体

        Args:
            media_id: 媒体 ID

        Returns:
            删除结果
        """
        return self.request_json(
            "POST",
            "/api/v1/ig/media/delete",
            json={"mediaId": media_id}
        )

    def get_user_media_raw(
        self,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        count: int = 12,
        after: Optional[str] = None,
    ) -> Dict[Any, Any]:
        """获取用户媒体列表

        Args:
            user_id: 用户 ID（可选）
            username: 用户名（可选）
            count: 获取数量（默认 12）
            after: 分页游标

        Returns:
            媒体列表和分页信息
        """
        params = {"count": count}
        if user_id:
            params["userId"] = user_id
        if username:
            params["username"] = username
        if after:
            params["after"] = after

        return self.request_json("GET", "/api/v1/ig/user/media", params=params)

    def test_connection_raw(self) -> Dict[Any, Any]:
        """测试连接

        Returns:
            连接状态和用户信息
        """
        try:
            result = self.get_account_info_raw()
            return {
                "success": True,
                "userId": result.get("pk"),
                "username": result.get("username"),
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

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
