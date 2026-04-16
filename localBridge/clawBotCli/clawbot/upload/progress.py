from __future__ import annotations

import threading


class ProgressDisplay:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.lock = threading.Lock()

    def show_upload_progress(self, current: int, total: int, file_name: str) -> None:
        with self.lock:
            percent = (current / total) * 100
            bar_length = 40
            filled = int(bar_length * current / total)
            bar = "=" * filled + "-" * (bar_length - filled)
            print(f"\rUploading {file_name}: [{bar}] {percent:.1f}% ({current}/{total} chunks)", end="", flush=True)
            if current == total:
                print()

    def show_task_progress(self, state: str, phase: str, progress: float) -> None:
        with self.lock:
            if state == "running":
                percent = progress * 100
                print(f"\rTask {state}: {phase} - {percent:.1f}%        ", end="", flush=True)
            else:
                print(f"\nTask {state}: {phase}")

    def show_error(self, error_code: str, error_message: str) -> None:
        with self.lock:
            print(f"\nError [{error_code}]: {error_message}")
