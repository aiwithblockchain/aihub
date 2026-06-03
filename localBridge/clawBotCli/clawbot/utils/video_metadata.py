"""Video metadata extraction utilities."""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any, Dict

logger = logging.getLogger(__name__)


class VideoMetadataError(Exception):
    """视频元数据提取错误。"""
    pass


def extract_video_metadata(file_path: str, timeout: int = 30) -> Dict[str, Any]:
    """提取视频元数据（宽高、时长）。

    使用 ffprobe 提取视频元数据，避免在浏览器端处理大文件。

    Args:
        file_path: 视频文件路径
        timeout: ffprobe 超时时间（秒）

    Returns:
        包含 width, height, durationMs 的字典

    Raises:
        VideoMetadataError: 如果 ffprobe 不可用或提取失败
    """
    # 检查 ffprobe 是否可用
    try:
        result = subprocess.run(
            ["ffprobe", "-version"],
            capture_output=True,
            timeout=5
        )
        if result.returncode != 0:
            raise VideoMetadataError(
                "ffprobe is not available. Please install ffmpeg:\n"
                "  macOS: brew install ffmpeg\n"
                "  Ubuntu/Debian: sudo apt-get install ffmpeg\n"
                "  Windows: Download from https://ffmpeg.org/download.html"
            )
    except FileNotFoundError:
        raise VideoMetadataError(
            "ffprobe is not installed. Please install ffmpeg:\n"
            "  macOS: brew install ffmpeg\n"
            "  Ubuntu/Debian: sudo apt-get install ffmpeg\n"
            "  Windows: Download from https://ffmpeg.org/download.html"
        )
    except subprocess.TimeoutExpired:
        raise VideoMetadataError("ffprobe version check timed out")

    # 提取视频元数据
    try:
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

        if result.returncode != 0:
            raise VideoMetadataError(
                f"ffprobe failed to extract metadata from '{file_path}': {result.stderr}"
            )

        data = json.loads(result.stdout)

        # 查找视频流
        video_stream = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                video_stream = stream
                break

        if not video_stream:
            raise VideoMetadataError(f"No video stream found in '{file_path}'")

        metadata = {
            "width": video_stream.get("width", 0),
            "height": video_stream.get("height", 0),
            "durationMs": int(float(data.get("format", {}).get("duration", 0)) * 1000),
        }

        logger.info(f"[extract_video_metadata] Extracted: {metadata['width']}x{metadata['height']} duration={metadata['durationMs']}ms")
        return metadata

    except subprocess.TimeoutExpired:
        raise VideoMetadataError(f"ffprobe timed out after {timeout}s while processing '{file_path}'")
    except json.JSONDecodeError as e:
        raise VideoMetadataError(f"Failed to parse ffprobe output: {e}")
    except Exception as e:
        raise VideoMetadataError(f"Failed to extract video metadata: {e}")