"""Reusable workflow helpers built on top of service layer."""

from __future__ import annotations

from typing import Optional

from clawbot.domain.models import ActionResult, AIMessageResult, XUser
from clawbot.errors import ParseError
from clawbot.services.ai_chat import AIChatService
from clawbot.services.media import MediaService
from clawbot.services.x_actions import XActionsService
from clawbot.services.x_read import XReadService
from clawbot.services.x_status import XStatusService
from clawbot.services.x_tabs import XTabsService


class CommonWorkflows:
    def __init__(
        self,
        status: XStatusService,
        read: XReadService,
        actions: XActionsService,
        tabs: XTabsService,
        ai: AIChatService,
        media: MediaService,
    ):
        self.status = status
        self.read = read
        self.actions = actions
        self.tabs = tabs
        self.ai = ai
        self.media = media

    def read_and_like_first_tweet(self, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> ActionResult:
        tweet = self.read.get_first_timeline_tweet(tab_id=tab_id, instance_id=instance_id)
        if not tweet or not tweet.id:
            raise ParseError("No tweet found in timeline")
        return self.actions.like(tweet.id, tab_id=tab_id, instance_id=instance_id)

    def search_and_fetch_profile(self, query: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> Optional[XUser]:
        user = self.read.search_first_user(query=query, tab_id=tab_id, instance_id=instance_id)
        if not user or not user.screen_name:
            return None
        return self.read.get_user(user.screen_name, tab_id=tab_id, instance_id=instance_id)

    def reply_to_pinned_tweet(self, username: str, text: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> ActionResult:
        tweet = self.read.get_pinned_tweet(username, tab_id=tab_id, instance_id=instance_id)
        if not tweet or not tweet.id:
            raise ParseError(f"No pinned tweet found for @{username}")
        return self.actions.reply(tweet.id, text, tab_id=tab_id, instance_id=instance_id)

    def analyze_tweet_and_generate_reply(self, tweet_id: str, platform: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> AIMessageResult:
        tweet = self.read.get_tweet(tweet_id, tab_id=tab_id, instance_id=instance_id)
        prompt = (
            "Read the following tweet and draft a concise reply under 280 characters.\n\n"
            f"Tweet text: {tweet.text or ''}"
        )
        return self.ai.send_message(platform=platform, prompt=prompt)

    def reply_to_pinned_tweet_with_ai(self, username: str, platform: str, tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> ActionResult:
        tweet = self.read.get_pinned_tweet(username, tab_id=tab_id, instance_id=instance_id)
        if not tweet or not tweet.id:
            raise ParseError(f"No pinned tweet found for @{username}")
        ai_result = self.analyze_tweet_and_generate_reply(tweet.id, platform=platform, tab_id=tab_id, instance_id=instance_id)
        if not ai_result.content:
            raise ParseError("AI did not return reply content")
        return self.actions.reply(tweet.id, ai_result.content, tab_id=tab_id, instance_id=instance_id)

    def post_text_with_media(self, text: str, *paths: str) -> ActionResult:
        return self.media.post_tweet(text=text, file_paths=paths)
