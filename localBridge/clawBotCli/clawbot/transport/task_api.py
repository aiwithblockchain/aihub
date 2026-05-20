"""Raw REST mappings for long-running task operations."""

from __future__ import annotations

from typing import Any, Dict

from .base import BaseApiTransport


class TaskApiTransport(BaseApiTransport):
    def create_task_raw(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.request_json("POST", "/api/v1/tasks", json=payload)

    def upload_input_part_raw(self, task_id: str, part_index: int, data: bytes) -> Dict[str, Any]:
        return self.request_json(
            "PUT",
            f"/api/v1/tasks/{task_id}/input/{part_index}",
            data=data,
            headers={"Content-Type": "application/octet-stream"},
        )

    def seal_input_raw(self, task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.request_json("POST", f"/api/v1/tasks/{task_id}/seal", json=payload)

    def start_task_raw(self, task_id: str) -> Dict[str, Any]:
        return self.request_json("POST", f"/api/v1/tasks/{task_id}/start")

    def get_task_status_raw(self, task_id: str) -> Dict[str, Any]:
        return self.request_json("GET", f"/api/v1/tasks/{task_id}")

    def get_task_result_raw(self, task_id: str) -> bytes:
        return self.request_bytes("GET", f"/api/v1/tasks/{task_id}/result")

    def cancel_task_raw(self, task_id: str) -> Dict[str, Any]:
        return self.request_json("POST", f"/api/v1/tasks/{task_id}/cancel")
