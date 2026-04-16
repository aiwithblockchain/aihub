"""Primary library entrypoint for external projects."""

from __future__ import annotations

from types import SimpleNamespace

from clawbot.config import API_BASE_URL, API_TIMEOUT
from clawbot.services.ai_chat import AIChatService
from clawbot.services.media import MediaService
from clawbot.services.x_actions import XActionsService
from clawbot.services.x_read import XReadService
from clawbot.services.x_status import XStatusService
from clawbot.services.x_tabs import XTabsService
from clawbot.transport.ai_api import AIApiTransport
from clawbot.transport.task_api import TaskApiTransport
from clawbot.transport.x_api import XApiTransport
from clawbot.upload.task_client import TaskApiClient
from clawbot.workflows.common import CommonWorkflows


class ClawBotClient:
    """High-level entrypoint for clawbot library consumers."""

    def __init__(self, base_url: str = API_BASE_URL, timeout: int = API_TIMEOUT):
        self.x_transport = XApiTransport(base_url=base_url, timeout=timeout)
        self.ai_transport = AIApiTransport(base_url=base_url, timeout=timeout)
        self.task_transport = TaskApiTransport(base_url=base_url, timeout=timeout)

        self.x_status = XStatusService(self.x_transport)
        self.x_read = XReadService(self.x_transport)
        self.x_actions = XActionsService(self.x_transport)
        self.x_tabs = XTabsService(self.x_transport)
        self.ai_chat = AIChatService(self.ai_transport)
        self.task_client = TaskApiClient(self.task_transport)
        self.media = MediaService(self.task_client, self.x_actions)

        self.x = SimpleNamespace(
            status=self.x_status,
            timeline=self.x_read,
            tweets=self.x_read,
            users=self.x_read,
            search=self.x_read,
            actions=self.x_actions,
            tabs=self.x_tabs,
        )
        self.ai = SimpleNamespace(
            status=self.ai_chat,
            chat=self.ai_chat,
            navigation=self.ai_chat,
        )
        self.workflows = CommonWorkflows(
            status=self.x_status,
            read=self.x_read,
            actions=self.x_actions,
            tabs=self.x_tabs,
            ai=self.ai_chat,
            media=self.media,
        )
