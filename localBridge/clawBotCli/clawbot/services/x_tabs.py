"""Service layer for X tab operations."""

from __future__ import annotations

from typing import Optional

from clawbot.domain.models import XTab
from clawbot.domain.result import build_action_result
from clawbot.transport.x_api import XApiTransport


class XTabsService:
    def __init__(self, transport: XApiTransport):
        self.transport = transport

    def open(self, path: str = "home") -> XTab:
        raw = self.transport.open_tab_raw(path=path)
        return XTab(tab_id=raw.get("tabId"), raw=raw)

    def navigate(self, path: str, tab_id: Optional[int] = None):
        return build_action_result("navigate_tab", self.transport.navigate_tab_raw(path=path, tab_id=tab_id), target_id=str(tab_id) if tab_id else None)

    def close(self, tab_id: int):
        return build_action_result("close_tab", self.transport.close_tab_raw(tab_id=tab_id), target_id=str(tab_id))
