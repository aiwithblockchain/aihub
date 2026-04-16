"""Service layer for X status and metadata."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from clawbot.domain.models import XStatus, XTab, XUser
from clawbot.domain.x_parsers import parse_basic_user, parse_x_status
from clawbot.transport.x_api import XApiTransport


class XStatusService:
    def __init__(self, transport: XApiTransport):
        self.transport = transport

    def get_status(self) -> XStatus:
        return parse_x_status(self.transport.get_status_raw())

    def is_logged_in(self) -> bool:
        return self.get_status().is_logged_in

    def list_tabs(self) -> List[XTab]:
        return self.get_status().tabs

    def get_default_tab_id(self) -> Optional[int]:
        tabs = self.list_tabs()
        return tabs[0].tab_id if tabs else None

    def get_instances(self) -> Dict[str, Any] | List[Dict[str, Any]]:
        return self.transport.get_instances_raw()

    def get_basic_info(self) -> XUser:
        return parse_basic_user(self.transport.get_basic_info_raw())

    def get_docs_raw(self):
        return self.transport.get_docs_raw()
