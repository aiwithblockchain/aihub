"""High-level Instagram (igClaw) service operations."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

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

    # ── Followers & Following ──────────────────────────────────────────────────

    def get_followers(
        self,
        user_id: str,
        count: int = 12,
        max_id: Optional[str] = None,
        search_surface: str = "follow_list_page",
    ) -> Dict[str, Any]:
        """Get followers list.

        Args:
            user_id: User ID to get followers for
            count: Number of followers to fetch (default 12)
            max_id: Pagination cursor for next page
            search_surface: Search surface type (default "follow_list_page")

        Returns:
            Dict with users, hasMore, nextMaxId, pageSize
        """
        return self.transport.get_followers_raw(
            user_id=user_id,
            count=count,
            max_id=max_id,
            search_surface=search_surface,
        )

    def get_following(
        self,
        user_id: str,
        count: int = 12,
        max_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get following list.

        Args:
            user_id: User ID to get following for
            count: Number of following to fetch (default 12)
            max_id: Pagination cursor for next page

        Returns:
            Dict with users, hasMore, nextMaxId, pageSize
        """
        return self.transport.get_following_raw(
            user_id=user_id,
            count=count,
            max_id=max_id,
        )

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
        image_paths: Union[str, List[str]],
        caption: str,
        disable_comments: bool = False,
        share_to_threads: bool = True,
        location: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Post a media (single image or carousel) to Instagram.

        Args:
            image_paths: Single image path or a list of image paths for multi-image post
            caption: Caption text
            disable_comments: Whether to disable comments
            share_to_threads: Whether to share to Threads
            location: Location info (optional)

        Returns:
            Media object
        """
        import base64

        paths: List[str] = [image_paths] if isinstance(image_paths, str) else image_paths
        if not paths:
            raise ValueError("At least one image path is required")

        # Validate all paths exist
        for p in paths:
            if not Path(p).exists():
                raise FileNotFoundError(f"Image file not found: {p}")

        if len(paths) == 1:
            # Single image: use base64 for backward compatibility
            image_path_obj = Path(paths[0])
            with open(image_path_obj, "rb") as f:
                image_bytes = f.read()
            image_base64 = base64.b64encode(image_bytes).decode("utf-8")

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
        else:
            # Multi-image: use imageBase64List (list of base64 strings)
            image_base64_list: List[str] = []
            for p in paths:
                with open(p, "rb") as f:
                    data = f.read()
                image_base64_list.append(base64.b64encode(data).decode("utf-8"))

            # Use MIME type of first image for the request
            suffix = Path(paths[0]).suffix.lower()
            mime_type_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }
            mime_type = mime_type_map.get(suffix, "image/jpeg")

            return self.transport.post_media_raw(
                image_base64_list=image_base64_list,
                caption=caption,
                mime_type=mime_type,
                disable_comments=disable_comments,
                share_to_threads=share_to_threads,
                location=location,
            )

    def post_video(
        self,
        video_path: str,
        caption: str,
        duration: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        disable_comments: bool = False,
        share_to_threads: bool = True,
        thumbnail_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Post a video to Instagram.

        Args:
            video_path: Path to the video file
            caption: Caption text
            duration: Video duration in milliseconds (auto-detected if not provided)
            width: Video width (auto-detected if not provided)
            height: Video height (auto-detected if not provided)
            disable_comments: Whether to disable comments
            share_to_threads: Whether to share to Threads
            thumbnail_path: Path to custom thumbnail image (optional, auto-generated if not provided)

        Returns:
            Media object
        """
        import base64
        import subprocess
        import json
        from pathlib import Path

        # Read video file
        video_path_obj = Path(video_path)
        if not video_path_obj.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        with open(video_path_obj, "rb") as f:
            video_bytes = f.read()

        # Convert to base64
        video_base64 = base64.b64encode(video_bytes).decode("utf-8")

        # Determine MIME type
        suffix = video_path_obj.suffix.lower()
        mime_type_map = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".avi": "video/x-msvideo",
        }
        mime_type = mime_type_map.get(suffix, "video/mp4")

        # Auto-detect video parameters using ffprobe if not provided
        if duration is None or width is None or height is None:
            try:
                # Use ffprobe to get video metadata
                cmd = [
                    "ffprobe",
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height,duration",
                    "-of", "json",
                    str(video_path_obj)
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)

                if result.returncode == 0:
                    metadata = json.loads(result.stdout)
                    stream = metadata.get("streams", [{}])[0]

                    if duration is None:
                        duration_sec = float(stream.get("duration", 10))
                        duration = int(duration_sec * 1000)  # Convert to milliseconds

                    if width is None:
                        width = int(stream.get("width", 720))

                    if height is None:
                        height = int(stream.get("height", 1280))

                    print(f"[IG] Auto-detected video: {width}x{height}, {duration}ms")
                else:
                    # ffprobe failed, use defaults
                    if duration is None:
                        duration = 10000
                    if width is None:
                        width = 720
                    if height is None:
                        height = 1280
                    print(f"[IG] Warning: ffprobe failed, using defaults: {width}x{height}, {duration}ms")
            except Exception as e:
                # ffprobe not available or failed, use defaults
                if duration is None:
                    duration = 10000
                if width is None:
                    width = 720
                if height is None:
                    height = 1280
                print(f"[IG] Warning: Could not auto-detect video params ({e}), using defaults: {width}x{height}, {duration}ms")

        # Handle custom thumbnail
        thumbnail_base64 = None
        if thumbnail_path:
            thumbnail_path_obj = Path(thumbnail_path)
            if not thumbnail_path_obj.exists():
                raise FileNotFoundError(f"Thumbnail file not found: {thumbnail_path}")

            with open(thumbnail_path_obj, "rb") as f:
                thumbnail_bytes = f.read()

            thumbnail_base64 = base64.b64encode(thumbnail_bytes).decode("utf-8")
            print(f"[IG] Using custom thumbnail: {thumbnail_path}, size={len(thumbnail_bytes)} bytes")
        else:
            print(f"[IG] No custom thumbnail provided, will auto-generate")

        return self.transport.post_video_raw(
            video_base64=video_base64,
            caption=caption,
            mime_type=mime_type,
            duration=duration,
            width=width,
            height=height,
            disable_comments=disable_comments,
            share_to_threads=share_to_threads,
            thumbnail_base64=thumbnail_base64,
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

    def get_user_media(
        self,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        count: int = 12,
        after: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get user's media posts.

        Args:
            user_id: User ID (optional)
            username: Username (optional)
            count: Number of posts to fetch (default 12)
            after: Pagination cursor

        Returns:
            Media list and pagination info
        """
        return self.transport.get_user_media_raw(
            user_id=user_id,
            username=username,
            count=count,
            after=after,
        )

    def test_connection(self) -> Dict[str, Any]:
        """
        Test API connection and get user info.

        Returns:
            Connection status and user info
        """
        return self.transport.test_connection_raw()

    def get_notifications(self) -> Dict[str, Any]:
        """
        Get Instagram notifications.

        Returns:
            {
                'notifications': [...],  # All notifications
                'newStories': [...],      # New notifications
                'oldStories': [...],      # Old notifications
                'hasMore': bool,          # Has more (usually False)
                'partition': {...},       # Time partition info
            }
        """
        return self.transport.get_notifications_raw()

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

    def search(
        self,
        query: str,
        after: Optional[str] = None,
        before: Optional[str] = None,
        first: Optional[int] = None,
        last: Optional[int] = None,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Search Instagram content (users, hashtags, places) with pagination support.

        Args:
            query: Search keyword
            after: Pagination cursor (forward)
            before: Pagination cursor (backward)
            first: Number of items to fetch (from start)
            last: Number of items to fetch (from end)
            context: Search type (blended=all | users=users only | hashtags=hashtags only | places=places only)

        Returns:
            Search results with:
            - results: List of users, hashtags, places, and media
            - hasMore: Whether more results exist
            - endCursor: Cursor for next page
            - startCursor: Cursor for previous page
        """
        return self.transport.search(query, after=after, before=before, first=first, last=last, context=context)
