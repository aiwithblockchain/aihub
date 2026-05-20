"""Service layer for media upload and post helpers."""

from __future__ import annotations

import json
import os
from typing import Iterable, List, Optional

from clawbot.domain.models import MediaUploadResult
from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError
from clawbot.services.x_actions import XActionsService
from clawbot.upload.chunked_uploader import ChunkedUploader
from clawbot.upload.progress import ProgressDisplay
from clawbot.upload.task_client import TaskApiClient


class MediaService:
    def __init__(self, task_client: TaskApiClient, actions: XActionsService, uploader: ChunkedUploader | None = None, progress: ProgressDisplay | None = None):
        self.task_client = task_client
        self.actions = actions
        self.uploader = uploader or ChunkedUploader(task_client)
        self.progress = progress or ProgressDisplay()

    def upload(self, file_path: str, client_name: str = "tweetClaw", instance_id: Optional[str] = None, tab_id: Optional[int] = None) -> MediaUploadResult:
        if not os.path.exists(file_path):
            raise MediaUploadError(f"File does not exist: {file_path}")

        task_id = None
        try:
            if not instance_id:
                instance_id = self.task_client.get_default_instance_id(client_name)
            task_id = self.task_client.create_task(
                client_name=client_name,
                instance_id=instance_id,
                task_kind="x.media_upload",
                input_mode="chunked_binary",
                params={"tabId": tab_id},
            )
            total_parts, total_bytes, content_type = self.uploader.upload_file(
                task_id,
                file_path,
                progress_callback=lambda current, total: self.progress.show_upload_progress(current, total, os.path.basename(file_path)),
            )
            self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
            self.task_client.start_task(task_id)
            self.task_client.wait_for_completion(
                task_id,
                poll_interval=2.0,
                timeout=300.0,
                progress_callback=lambda state, phase, prog: self.progress.show_task_progress(state, phase, prog),
            )
            result_bytes = self.task_client.get_task_result(task_id)
            try:
                result_json = json.loads(result_bytes)
            except json.JSONDecodeError as exc:
                raise ParseError("Task result is not valid JSON") from exc
            media_id = result_json.get("mediaId")
            if not media_id:
                raise MediaUploadError("Task result missing mediaId")
            return MediaUploadResult(success=True, media_id=media_id, file_path=file_path, raw=result_json)
        except KeyboardInterrupt:
            if task_id:
                self.task_client.cancel_task(task_id)
            raise
        except Exception as exc:
            if task_id:
                try:
                    self.task_client.cancel_task(task_id)
                except Exception:
                    pass
            if isinstance(exc, (MediaUploadError, ParseError, TaskTimeoutError)):
                raise
            raise MediaUploadError(str(exc)) from exc

    def upload_many(self, paths: Iterable[str], client_name: str = "tweetClaw", instance_id: Optional[str] = None, tab_id: Optional[int] = None) -> List[MediaUploadResult]:
        return [self.upload(path, client_name=client_name, instance_id=instance_id, tab_id=tab_id) for path in paths]

    def post_tweet(self, text: str, file_paths: Iterable[str], instance_id: Optional[str] = None, tab_id: Optional[int] = None):
        uploads = self.upload_many(file_paths, instance_id=instance_id, tab_id=tab_id)
        media_ids = [item.media_id for item in uploads if item.media_id]
        return self.actions.create_tweet(text=text, media_ids=media_ids)

    def reply_with_media(self, tweet_id: str, text: str, file_paths: Iterable[str], instance_id: Optional[str] = None, tab_id: Optional[int] = None):
        uploads = self.upload_many(file_paths, instance_id=instance_id, tab_id=tab_id)
        media_ids = [item.media_id for item in uploads if item.media_id]
        return self.actions.reply(tweet_id=tweet_id, text=text, media_ids=media_ids)
