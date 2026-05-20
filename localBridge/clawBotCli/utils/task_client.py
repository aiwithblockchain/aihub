"""Compatibility wrapper for the new upload task client.

Deprecated: prefer `clawbot.upload.task_client.TaskApiClient` in new code.
"""

from clawbot.config import API_BASE_URL, API_TIMEOUT
from clawbot.transport.task_api import TaskApiTransport
from clawbot.upload.task_client import TaskApiClient


class TaskClient(TaskApiClient):
    """Legacy-compatible task client with old constructor shape."""

    def __init__(self, base_url: str = API_BASE_URL, timeout: int = API_TIMEOUT, config_path: str | None = None):
        super().__init__(TaskApiTransport(base_url=base_url, timeout=timeout), config_path=config_path)
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout


def build_task_client(base_url: str = API_BASE_URL, config_path: str | None = None) -> TaskClient:
    return TaskClient(base_url=base_url, config_path=config_path)
