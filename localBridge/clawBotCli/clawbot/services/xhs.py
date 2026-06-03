"""High-level XHS (Xiaohongshu) service operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from clawbot.transport.xhs_api import XhsApiTransport
from clawbot.utils.video_metadata import extract_video_metadata


class XhsService:
    """Unified service for XHS read and write operations."""

    def __init__(self, transport: XhsApiTransport, task_client=None):
        self.transport = transport
        self.task_client = task_client

    # ── Account & Status ──────────────────────────────────────────────────────

    def get_account_info(self) -> Dict[str, Any]:
        """Get current XHS account information."""
        return self.transport.get_account_info_raw()

    # ── Feed & Content Discovery ──────────────────────────────────────────────

    def get_homefeed(self, cursor_score: Optional[str] = None) -> Dict[str, Any]:
        """Get XHS home feed with optional pagination cursor."""
        return self.transport.get_homefeed_raw(cursor_score=cursor_score)

    def get_feed(self, note_id: str, xsec_token: Optional[str] = None, xsec_source: Optional[str] = None) -> Dict[str, Any]:
        """Get a specific note's feed data by note ID."""
        return self.transport.get_feed_raw(note_id=note_id, xsec_token=xsec_token, xsec_source=xsec_source)

    def search(self, keyword: str, cursor: Optional[str] = None, page_size: int = 20) -> Dict[str, Any]:
        """Search XHS notes by keyword with pagination."""
        return self.transport.search_raw(keyword=keyword, cursor=cursor, page_size=page_size)

    # ── User Content ──────────────────────────────────────────────────────────

    def get_user_notes(self, user_id: str, cursor: Optional[str] = None, xsec_token: Optional[str] = None, xsec_source: Optional[str] = None) -> Dict[str, Any]:
        """Get all notes published by a specific user."""
        return self.transport.get_user_notes_raw(user_id=user_id, cursor=cursor, xsec_token=xsec_token, xsec_source=xsec_source)

    def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific user."""
        return self.transport.get_user_info_raw(user_id=user_id)

    # ── Note Interactions ─────────────────────────────────────────────────────

    def get_note_comments(self, note_id: str, cursor: Optional[str] = None, xsec_token: Optional[str] = None) -> Dict[str, Any]:
        """Get comments for a specific note with pagination."""
        return self.transport.get_note_comments_raw(note_id=note_id, cursor=cursor, xsec_token=xsec_token)

    # ── Publishing ────────────────────────────────────────────────────────────

    def publish_note(
        self,
        title: str,
        desc: str,
        images: List[Dict[str, Any]],
        privacy_type: int = 0,
        privacy_user_ids: Optional[List[str]] = None,
        topics: Optional[List[Dict[str, Any]]] = None,
        scheduled_publish_time: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Publish a new image note to XHS.

        Args:
            title: Note title (max 20 characters)
            desc: Note description/content
            images: List of image dicts with 'data' (base64) and 'mime_type'
            privacy_type: 0=public, 1=private, 3=specific users, 4=friends (default: 0)
            privacy_user_ids: User IDs for type=3 (specific users visible)
            topics: Optional list of topic dicts with 'id' and 'name' fields
            scheduled_publish_time: Optional Unix timestamp (seconds) for scheduled publish
        """
        return self.transport.publish_note_raw(
            title=title,
            desc=desc,
            images=images,
            privacy_type=privacy_type,
            privacy_user_ids=privacy_user_ids,
            topics=topics,
            scheduled_publish_time=scheduled_publish_time,
        )

    # ── Topics & Discovery ────────────────────────────────────────────────────

    def search_topics(self, keyword: str) -> Dict[str, Any]:
        """Search for XHS topics/hashtags by keyword."""
        return self.transport.search_topics_raw(keyword=keyword)

    # ── Notifications ─────────────────────────────────────────────────────────

    def get_notifications(self, notif_type: str, cursor: Optional[str] = None) -> Dict[str, Any]:
        """
        Get XHS notifications.

        Args:
            notif_type: 'mentions' or 'likes'
            cursor: Optional pagination cursor
        """
        if notif_type not in ("mentions", "likes"):
            raise ValueError("notif_type must be 'mentions' or 'likes'")
        return self.transport.get_notifications_raw(notif_type=notif_type, cursor=cursor)

    # ── My Content ────────────────────────────────────────────────────────────

    def get_published_notes(self, cursor: Optional[str] = None) -> Dict[str, Any]:
        """Get all notes published by the current account."""
        return self.transport.get_published_notes_raw(cursor=cursor)

    def publish_video_note(
        self,
        title: str,
        desc: str,
        video: Dict[str, Any],
        privacy_type: int = 0,
        privacy_user_ids: Optional[List[str]] = None,
        topics: Optional[List[Dict[str, Any]]] = None,
        scheduled_publish_time: Optional[int] = None,
        cover: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Publish a new video note to XHS.

        Args:
            title: Note title
            desc: Note description/content
            video: Dict with 'base64' (pure base64, no data: prefix) and optional 'mimeType'
            privacy_type: 0=public, 1=private, 3=specific users, 4=friends (default: 0)
            privacy_user_ids: User IDs for type=3 (specific users visible)
            topics: Optional list of topic dicts with 'id' and 'name' fields
            scheduled_publish_time: Optional Unix timestamp (seconds) for scheduled publish
            cover: Optional custom cover dict with 'base64' and optional 'mimeType'
        """
        return self.transport.publish_video_note_raw(
            title=title,
            desc=desc,
            video=video,
            privacy_type=privacy_type,
            privacy_user_ids=privacy_user_ids,
            topics=topics,
            scheduled_publish_time=scheduled_publish_time,
            cover=cover,
        )

    def get_friend_fans(self, cursor: str = '', size: int = 20) -> Dict[str, Any]:
        """
        Get friends/fans list for privacy type=3 (specific users visible).

        Args:
            cursor: Pagination cursor (empty string for first page)
            size: Number of results per page (default: 20)
        """
        return self.transport.get_friend_fans_raw(cursor=cursor, size=size)

    # ── Collection Management ─────────────────────────────────────────────────

    def create_collection(
        self,
        name: str,
        desc: str = '',
        cover: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new collection.

        Args:
            name: Collection name
            desc: Collection description
            cover: Optional cover image dict with 'base64' and optional 'mimeType'
        Returns:
            Dict with 'collection_id'
        """
        return self.transport.create_collection_raw(name=name, desc=desc, cover=cover)

    def list_collections(self, cursor: str = '') -> Dict[str, Any]:
        """
        List user's collections.

        Args:
            cursor: Pagination cursor (empty string for first page)
        """
        return self.transport.list_collections_raw(cursor=cursor)

    def list_collection_notes(self, collection_id: str) -> Dict[str, Any]:
        """
        List notes in a collection.

        Args:
            collection_id: The collection ID
        """
        return self.transport.list_collection_notes_raw(collection_id=collection_id)

    def update_collection(
        self,
        collection_id: str,
        name: str,
        desc: str = '',
        cover: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Update collection info.

        Args:
            collection_id: The collection ID to update
            name: New collection name
            desc: New collection description
            cover: Optional new cover image dict with 'base64' and optional 'mimeType'. Omit to keep existing cover.
        """
        return self.transport.update_collection_raw(
            collection_id=collection_id, name=name, desc=desc, cover=cover,
        )

    # ── Search Filters ────────────────────────────────────────────────────────

    def search_filter(self, keyword: str, search_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get available search filter options for a keyword.

        Returns filter groups like sort_type, filter_note_type, filter_note_time, etc.
        Useful for discovering valid filter tag values before calling search().

        Args:
            keyword: Search keyword
            search_id: Optional search_id from a prior search() call (for consistency)
        """
        return self.transport.search_filter_raw(keyword=keyword, search_id=search_id)

    # ── Comments ──────────────────────────────────────────────────────────────

    def post_comment(
        self,
        note_id: str,
        content: str,
        target_comment_id: Optional[str] = None,
        at_users: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Post a comment on a note or reply to an existing comment.

        Args:
            note_id: The note ID to comment on
            content: Comment content text
            target_comment_id: If replying to a comment, the comment ID to reply to
            at_users: Optional list of user dicts to @mention, each with 'user_id' and 'nickname'
        """
        return self.transport.post_comment_raw(
            note_id=note_id,
            content=content,
            target_comment_id=target_comment_id,
            at_users=at_users or [],
        )

    def search_users(self, keyword: str, page: int = 1, rows: int = 30) -> Dict[str, Any]:
        """
        Search for users by keyword (for @mention in comments).

        Returns users with full userid (including token suffix) needed for at_users.

        Args:
            keyword: Search keyword (nickname)
            page: Page number (default: 1)
            rows: Results per page (default: 30)
        """
        return self.transport.search_users_raw(keyword=keyword, page=page, rows=rows)

    def get_intimacy_list(self) -> Dict[str, Any]:
        """
        Get the full intimacy (friends) list.

        Returns all friends with full userid (including token suffix) needed for at_users.
        More accurate than search_users for finding specific friends.
        """
        return self.transport.get_intimacy_list_raw()

    def like_note(self, note_id: str) -> Dict[str, Any]:
        """
        Like a note.

        Args:
            note_id: The note OID to like (note_oid field)
        """
        return self.transport.like_note_raw(note_id=note_id)

    def unlike_note(self, note_id: str) -> Dict[str, Any]:
        """
        Unlike (dislike) a note.

        Args:
            note_id: The note OID to unlike (note_oid field)
        """
        return self.transport.unlike_note_raw(note_id=note_id)

    def follow_user(self, target_user_id: str) -> Dict[str, Any]:
        """
        Follow a user.

        Args:
            target_user_id: The user ID to follow (rid field, without hash suffix)
        """
        return self.transport.follow_user_raw(target_user_id=target_user_id)

    def unfollow_user(self, target_user_id: str) -> Dict[str, Any]:
        """
        Unfollow a user.

        Args:
            target_user_id: The user ID to unfollow (rid field, without hash suffix)
        """
        return self.transport.unfollow_user_raw(target_user_id=target_user_id)

    def collect_note(self, note_id: str) -> Dict[str, Any]:
        """
        Collect (bookmark) a note.

        Args:
            note_id: The note ID to collect
        """
        return self.transport.collect_note_raw(note_id=note_id)

    def publish_video_note_large(
        self,
        file_path: str,
        title: str,
        desc: str,
        privacy_type: int = 0,
        privacy_user_ids: Optional[List[str]] = None,
        cover_path: Optional[str] = None,
        topics: Optional[List[Dict[str, Any]]] = None,
        scheduled_publish_time: Optional[int] = None,
        instance_id: Optional[str] = None,
        tab_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """发布视频笔记（大文件走分片 Task 通道，绕过 Chrome 64 MiB 消息限制）。"""
        import os
        import base64
        import json
        import logging
        from clawbot.upload.chunked_uploader import ChunkedUploader

        logger = logging.getLogger(__name__)

        if self.task_client is None:
            raise RuntimeError("task_client is required for publish_video_note_large")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File does not exist: {file_path}")

        file_size = os.path.getsize(file_path)
        logger.info(f"[publish_video_note_large] START file={file_path} size={file_size} title={title}")

        cover = None
        if cover_path and os.path.exists(cover_path):
            with open(cover_path, "rb") as f:
                cover = {"base64": base64.b64encode(f.read()).decode(), "mimeType": "image/jpeg"}
            logger.info(f"[publish_video_note_large] Cover loaded from {cover_path}")

        # 提取视频元数据（避免在浏览器端处理大文件）
        video_metadata = extract_video_metadata(file_path)

        params: Dict[str, Any] = {
            "title": title,
            "desc": desc,
            "privacy_type": privacy_type,
            "privacy_user_ids": privacy_user_ids or [],
            "topics": topics or [],
            "cover": cover,
            "videoMetadata": video_metadata,  # 必须提供，extract_video_metadata 失败时会抛出异常
        }
        if scheduled_publish_time is not None:
            params["scheduled_publish_time"] = scheduled_publish_time
        if tab_id is not None:
            params["tabId"] = tab_id

        task_id = None
        try:
            if not instance_id:
                instance_id = self.task_client.get_default_instance_id("tweetClaw")

            task_id = self.task_client.create_task(
                client_name="tweetClaw",
                instance_id=instance_id,
                task_kind="xhs.publish_video",
                input_mode="chunked_binary",
                params=params,
            )
            logger.info(f"[publish_video_note_large] Task created taskId={task_id}")

            uploader = ChunkedUploader(self.task_client)
            total_parts, total_bytes, content_type = uploader.upload_file(task_id, file_path)
            logger.info(f"[publish_video_note_large] Upload complete parts={total_parts} bytes={total_bytes} type={content_type}")

            self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
            logger.info(f"[publish_video_note_large] Input sealed, starting task...")

            self.task_client.start_task(task_id)
            logger.info(f"[publish_video_note_large] Task started, waiting for completion...")

            self.task_client.wait_for_completion(task_id, poll_interval=3.0, timeout=600.0)

            result_bytes = self.task_client.get_task_result(task_id)
            result = json.loads(result_bytes)
            logger.info(f"[publish_video_note_large] Task completed noteId={result.get('data', {}).get('id', 'N/A')}")
            return result

        except Exception as e:
            logger.error(f"[publish_video_note_large] Task failed taskId={task_id} error={e}")
            if task_id:
                try:
                    self.task_client.cancel_task(task_id)
                except Exception:
                    pass
            raise

    def delete_note(self, note_id: str) -> Dict[str, Any]:
        """
        Delete a note (must be executed from creator.xiaohongshu.com context).

        Args:
            note_id: The note ID to delete
        """
        return self.transport.delete_note_raw(note_id=note_id)

    def delete_comment(self, note_id: str, comment_id: str) -> Dict[str, Any]:
        """
        Delete a comment.

        Args:
            note_id: The note ID the comment belongs to
            comment_id: The comment ID to delete
        """
        return self.transport.delete_comment_raw(note_id=note_id, comment_id=comment_id)
