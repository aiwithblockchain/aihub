from __future__ import annotations

import math
import mimetypes
import os
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from typing import Callable, Optional, Tuple

import requests


class ChunkedUploader:
    def __init__(self, task_client, chunk_size: int = 5 * 1024 * 1024, max_workers: int = 4, retry_count: int = 3):
        self.task_client = task_client
        self.chunk_size = chunk_size
        self.max_workers = max_workers
        self.retry_count = retry_count

    def _detect_content_type(self, file_path: str) -> str:
        content_type, _ = mimetypes.guess_type(file_path)
        return content_type or "application/octet-stream"

    def upload_file(self, task_id: str, file_path: str, progress_callback: Optional[Callable] = None) -> Tuple[int, int, str]:
        file_size = os.path.getsize(file_path)
        total_parts = max(1, math.ceil(file_size / self.chunk_size))
        content_type = self._detect_content_type(file_path)

        with open(file_path, "rb") as handle:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {}
                part_index = 0
                uploaded_count = 0

                while part_index < total_parts and len(futures) < self.max_workers:
                    chunk = handle.read(self.chunk_size)
                    if not chunk and part_index > 0:
                        break
                    future = executor.submit(self._upload_chunk, task_id, part_index, chunk, self.retry_count)
                    futures[future] = part_index
                    part_index += 1

                while futures:
                    done, _ = wait(futures.keys(), return_when=FIRST_COMPLETED)
                    for future in done:
                        try:
                            future.result()
                            uploaded_count += 1
                            if progress_callback:
                                progress_callback(uploaded_count, total_parts)
                        except Exception as exc:
                            for item in futures.keys():
                                item.cancel()
                            raise Exception(f"Upload failed at part {futures[future]}: {exc}")
                        finally:
                            del futures[future]

                    while part_index < total_parts and len(futures) < self.max_workers:
                        chunk = handle.read(self.chunk_size)
                        if not chunk:
                            break
                        future = executor.submit(self._upload_chunk, task_id, part_index, chunk, self.retry_count)
                        futures[future] = part_index
                        part_index += 1
        return total_parts, file_size, content_type

    def _upload_chunk(self, task_id: str, part_index: int, data: bytes, retry_count: int) -> None:
        for attempt in range(retry_count):
            try:
                self.task_client.upload_input_part(task_id, part_index, data)
                return
            except requests.exceptions.RequestException:
                if attempt == retry_count - 1:
                    raise
                time.sleep(min(2 ** attempt, 5))
