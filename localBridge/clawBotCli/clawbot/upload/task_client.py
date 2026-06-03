"""Upload task client built on top of task transport."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Callable, Optional

from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError
from clawbot.transport.task_api import TaskApiTransport


class TaskApiClient:
    """Task client that wraps long-running task REST operations."""

    def __init__(self, transport: TaskApiTransport, config_path: str | None = None):
        self.transport = transport
        self.config = self._load_config(config_path)
        self._instances_cache: dict | None = None

    def _load_config(self, config_path: str | None = None) -> dict:
        if config_path is None:
            config_path = os.path.expanduser("~/.aihub/config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as handle:
                    return json.load(handle)
            except json.JSONDecodeError as exc:
                raise ParseError(f"Invalid config JSON: {config_path}") from exc
        return {}

    def _fetch_instances_from_bridge(self) -> list:
        """动态从 LocalBridge 查询已连接的插件实例列表。"""
        try:
            # 复用 transport 的 base_url 和 session
            response = self.transport.request_json("GET", "/api/v1/plugins")
            if isinstance(response, list):
                return response
            return []
        except Exception:
            return []

    def get_default_instance_id(self, client_name: str) -> str:
        """获取指定客户端的默认实例 ID。

        优先级：
        1. 动态查询 LocalBridge 已连接实例
           - 单实例：返回该实例的真实 ID
           - 多实例：抛出错误，要求用户指定
        2. 配置文件中的静态配置（向后兼容）
        3. 空字符串（让 LocalBridge 在单实例时自动匹配）
        """
        # 尝试动态查询
        instances = self._fetch_instances_from_bridge()
        client_instances = [inst for inst in instances if inst.get("clientName") == client_name]

        if len(client_instances) == 1:
            # 单实例场景：返回真实的 instance ID
            return client_instances[0].get("instanceId", "")
        elif len(client_instances) > 1:
            # 多实例场景：抛出错误，要求用户指定
            instance_list = "\n".join([
                f"  - {inst.get('instanceId')} ({inst.get('instanceName', 'unnamed')})"
                for inst in client_instances
            ])
            raise ValueError(
                f"Multiple instances connected for '{client_name}'. "
                f"Please specify instance_id:\n{instance_list}"
            )

        # 回退到配置文件（向后兼容）
        instances_config = self.config.get("instances", {})
        instance_id = instances_config.get(client_name)
        return instance_id if instance_id else ""

    def create_task(self, client_name: str, instance_id: str, task_kind: str, input_mode: str, params: dict) -> str:
        payload = {
            "clientName": client_name,
            "instanceId": instance_id,
            "taskKind": task_kind,
            "inputMode": input_mode,
            "params": params,
        }
        response = self.transport.create_task_raw(payload)
        task_id = response.get("taskId")
        if not task_id:
            raise ParseError("Task creation response missing taskId")
        return task_id

    def upload_input_part(self, task_id: str, part_index: int, data: bytes) -> None:
        self.transport.upload_input_part_raw(task_id, part_index, data)

    def seal_input(self, task_id: str, total_parts: int, total_bytes: int, content_type: str) -> None:
        self.transport.seal_input_raw(
            task_id,
            {
                "totalParts": total_parts,
                "totalBytes": total_bytes,
                "contentType": content_type,
            },
        )

    def start_task(self, task_id: str) -> None:
        self.transport.start_task_raw(task_id)

    def get_task_status(self, task_id: str) -> dict:
        return self.transport.get_task_status_raw(task_id)

    def get_task_result(self, task_id: str) -> bytes:
        return self.transport.get_task_result_raw(task_id)

    def cancel_task(self, task_id: str) -> None:
        self.transport.cancel_task_raw(task_id)

    def wait_for_completion(
        self,
        task_id: str,
        poll_interval: float = 2.0,
        timeout: float = 300.0,
        progress_callback: Optional[Callable] = None,
    ) -> dict:
        start_time = time.time()
        last_progress = -1
        try:
            while True:
                if time.time() - start_time > timeout:
                    try:
                        self.cancel_task(task_id)
                        logging.info("Task %s cancelled due to timeout", task_id)
                    except Exception as exc:
                        logging.warning("Failed to cancel task on timeout: %s", exc)
                    raise TaskTimeoutError(f"Task {task_id} timeout after {timeout}s")

                status = self.get_task_status(task_id)
                state = status.get("state")
                if not state:
                    raise ParseError("Task status response missing state")
                if state == "completed":
                    return status
                if state in ["failed", "cancelled"]:
                    raise MediaUploadError(status.get("errorMessage") or f"Task {task_id} {state}")
                if progress_callback and status.get("progress", 0) != last_progress:
                    progress_callback(state, status.get("phase", ""), status.get("progress", 0))
                    last_progress = status.get("progress", 0)
                time.sleep(poll_interval)
        except KeyboardInterrupt:
            try:
                self.cancel_task(task_id)
            finally:
                raise
