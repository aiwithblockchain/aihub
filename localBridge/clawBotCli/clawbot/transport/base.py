"""Base transport for REST API access."""

from __future__ import annotations

import json
from typing import Any, Dict

import requests

from clawbot.errors import ApiRequestError


class BaseApiTransport:
    """Shared HTTP transport with normalized error handling."""

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def request_json(self, method: str, path: str, **kwargs) -> Dict[Any, Any]:
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", self.timeout)

        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as exc:
            response = exc.response
            error_message = str(exc)
            status_code = response.status_code if response is not None else None
            if response is not None:
                try:
                    payload = response.json()
                    if isinstance(payload, dict) and payload.get("error"):
                        error_message = payload["error"]
                    elif isinstance(payload, dict) and payload.get("message"):
                        error_message = payload["message"]
                    else:
                        error_message = json.dumps(payload, ensure_ascii=False)
                except ValueError:
                    body = response.text.strip()
                    if body:
                        error_message = body
            raise ApiRequestError(f"{method} {path} failed: {error_message} (status={status_code})") from exc
        except requests.exceptions.RequestException as exc:
            raise ApiRequestError(f"{method} {path} failed: {exc}") from exc

    def request_bytes(self, method: str, path: str, **kwargs) -> bytes:
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", self.timeout)
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as exc:
            raise ApiRequestError(f"{method} {path} failed: {exc}") from exc
