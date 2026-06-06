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
