"""Structured domain models for clawbot."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class XTab:
    tab_id: Optional[int]
    title: Optional[str] = None
    url: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class XStatus:
    has_x_tabs: bool
    is_logged_in: bool
    tabs: List[XTab] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class XUser:
    id: Optional[str]
    name: Optional[str] = None
    screen_name: Optional[str] = None
    description: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class XTweet:
    id: Optional[str]
    text: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_screen_name: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActionResult:
    success: bool
    action: str
    target_id: Optional[str] = None
    message: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AIMessageResult:
    success: bool
    content: Optional[str] = None
    conversation_id: Optional[str] = None
    platform: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MediaUploadResult:
    success: bool
    media_id: Optional[str] = None
    file_path: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)
