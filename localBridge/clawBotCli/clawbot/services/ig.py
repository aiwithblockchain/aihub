"""High-level Instagram (igClaw) service operations."""

from __future__ import annotations

from typing import Any, Dict, Optional

from clawbot.transport.ig_api import IgApiTransport


class IgService:
    """Unified service for Instagram read and write operations."""

    def __init__(self, transport: IgApiTransport):
        self.transport = transport

    # ── Status & Account ──────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """Check Instagram login status."""
        return self.transport.get_status_raw()

    def get_account_info(self) -> Dict[str, Any]:
        """Get current Instagram account information."""
        return self.transport.get_account_info_raw()

    # ── Feed ──────────────────────────────────────────────────────────────────

    def get_feed(self, max_id: Optional[str] = None) -> Dict[str, Any]:
        """Get Instagram home feed.

        Args:
            max_id: Pagination cursor for next page
        """
        return self.transport.get_feed_raw(max_id=max_id)

    def get_media_info(self, shortcode: str) -> Dict[str, Any]:
        """Get media details by shortcode.

        Args:
            shortcode: Instagram post shortcode (from URL or code field)

        Returns:
            Media info including like_count, comment_count, has_liked, etc.
        """
        return self.transport.get_media_info_raw(shortcode=shortcode)

    # ── User Info ─────────────────────────────────────────────────────────────

    def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific user by user ID."""
        return self.transport.get_user_info_raw(user_id=user_id)

    def search_user(self, username: str) -> Dict[str, Any]:
        """Search for a user ID by username."""
        return self.transport.search_user_raw(username=username)

    # ── Media Interactions ────────────────────────────────────────────────────

    def like_media(self, media_id: str) -> Dict[str, Any]:
        """Like a media post."""
        return self.transport.like_media_raw(media_id=media_id)

    def unlike_media(self, media_id: str) -> Dict[str, Any]:
        """Unlike a media post."""
        return self.transport.unlike_media_raw(media_id=media_id)

    # ── Follow ────────────────────────────────────────────────────────────────

    def follow_user(self, user_id: str) -> Dict[str, Any]:
        """Follow a user."""
        return self.transport.follow_user_raw(user_id=user_id)

    def unfollow_user(self, user_id: str) -> Dict[str, Any]:
        """Unfollow a user."""
        return self.transport.unfollow_user_raw(user_id=user_id)

    # ── Comments ──────────────────────────────────────────────────────────────

    def post_comment(
        self,
        media_id: str,
        text: str,
        replied_to_comment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Post a comment on a media post.

        Args:
            media_id: The media ID to comment on
            text: Comment text
            replied_to_comment_id: Optional comment ID to reply to
        """
        return self.transport.post_comment_raw(
            media_id=media_id,
            text=text,
            replied_to_comment_id=replied_to_comment_id,
        )

    def delete_comment(self, media_id: str, comment_id: str) -> Dict[str, Any]:
        """
        Delete a comment from a media post.

        Args:
            media_id: The media ID
            comment_id: The comment ID to delete

        Returns:
            Operation result
        """
        return self.transport.delete_comment_raw(
            media_id=media_id,
            comment_id=comment_id,
        )

    def post_media(
        self,
        image_path: str,
        caption: str,
        disable_comments: bool = False,
        share_to_threads: bool = True,
        location: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Post a media (image) to Instagram.

        Args:
            image_path: Path to the image file
            caption: Caption text
            disable_comments: Whether to disable comments
            share_to_threads: Whether to share to Threads
            location: Location info (optional)

        Returns:
            Media object
        """
        import base64
        from pathlib import Path

        # Read image file
        image_path_obj = Path(image_path)
        if not image_path_obj.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        with open(image_path_obj, "rb") as f:
            image_bytes = f.read()

        # Convert to base64
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Determine MIME type
        suffix = image_path_obj.suffix.lower()
        mime_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        mime_type = mime_type_map.get(suffix, "image/jpeg")

        return self.transport.post_media_raw(
            image_base64=image_base64,
            caption=caption,
            mime_type=mime_type,
            disable_comments=disable_comments,
            share_to_threads=share_to_threads,
            location=location,
        )

    def delete_media(self, media_id: str) -> Dict[str, Any]:
        """
        Delete a media post.

        Args:
            media_id: The media ID to delete

        Returns:
            Deletion result
        """
        return self.transport.delete_media_raw(media_id=media_id)

    def test_connection(self) -> Dict[str, Any]:
        """
        Test API connection and get user info.

        Returns:
            Connection status and user info
        """
        return self.transport.test_connection_raw()

    def check_login(self) -> bool:
        """
        Check if user is logged in to Instagram.

        Returns:
            True if logged in, False otherwise
        """
        try:
            result = self.get_account_info()
            # 检查 userId 字段（Python 返回的是 camelCase）
            return bool(result.get('userId') or result.get('pk'))
        except:
            return False

    def get_media_comments(
        self,
        media_id: str,
        min_id: Optional[str] = None,
        sort_order: Optional[str] = "popular",
        can_support_threading: bool = True,
        permalink_enabled: bool = False,
    ) -> Dict[str, Any]:
        """
        Get comments for a media post.

        Args:
            media_id: The media ID to get comments for
            min_id: Pagination cursor (JSON encoded)
            sort_order: Sort order ('popular' or 'chronological')
            can_support_threading: Whether to support comment replies
            permalink_enabled: Whether to enable permalinks

        Returns:
            Comments list and pagination info
        """
        return self.transport.get_media_comments_raw(
            media_id=media_id,
            min_id=min_id,
            sort_order=sort_order,
            can_support_threading=can_support_threading,
            permalink_enabled=permalink_enabled,
        )
