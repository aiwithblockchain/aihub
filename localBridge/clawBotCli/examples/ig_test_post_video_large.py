#!/usr/bin/env python3
"""
Instagram 大视频分片上传测试

使用 Task API 分片上传，绕过 Chrome 64 MiB 消息限制。
视频通过 LocalBridge -> tweetClaw bg -> IG content script -> Instagram rupload 分片上传。

Usage:
    python3 ig_test_post_video_large.py <video_path> <caption> [thumbnail_path]

Example:
    python3 examples/ig_test_post_video_large.py test_media/video.mp4 "Test large video"
    python3 examples/ig_test_post_video_large.py test_media/video.mp4 "Test" test_media/thumb.jpg
"""

import sys
import os
import json
import logging
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

from clawbot import ClawBotClient
from clawbot.upload.chunked_uploader import ChunkedUploader
from clawbot.utils.video_metadata import extract_video_metadata


def post_video_large(
    video_path: str,
    caption: str,
    thumbnail_path: str | None = None,
    disable_comments: bool = False,
    share_to_threads: bool = True,
    instance_id: str | None = None,
) -> dict:
    """发布大视频到 Instagram（分片 Task 通道）。

    Args:
        video_path: 视频文件路径
        caption: 文案
        thumbnail_path: 封面图路径（可选，不提供则自动生成）
        disable_comments: 是否禁用评论
        share_to_threads: 是否分享到 Threads
        instance_id: 指定 tweetClaw 实例 ID（多实例时必须指定）

    Returns:
        IG 媒体对象
    """
    import base64

    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    file_size = os.path.getsize(video_path)
    logger.info(f"Video: {video_path} ({file_size / 1024 / 1024:.1f} MB)")

    # 提取视频元数据
    logger.info("Extracting video metadata via ffprobe...")
    metadata = extract_video_metadata(video_path)
    width = metadata["width"]
    height = metadata["height"]
    duration_ms = metadata["durationMs"]
    logger.info(f"Video metadata: {width}x{height} duration={duration_ms}ms ({duration_ms/1000:.1f}s)")

    # 处理封面图
    thumbnail_base64 = None
    if thumbnail_path:
        if not os.path.exists(thumbnail_path):
            raise FileNotFoundError(f"Thumbnail file not found: {thumbnail_path}")
        with open(thumbnail_path, "rb") as f:
            thumbnail_base64 = base64.b64encode(f.read()).decode()
        thumb_size = os.path.getsize(thumbnail_path)
        logger.info(f"Thumbnail: {thumbnail_path} ({thumb_size} bytes)")
    else:
        logger.info("No thumbnail provided, IG content script will auto-generate one")

    client = ClawBotClient()

    if not instance_id:
        instance_id = client.task_client.get_default_instance_id("tweetClaw")
    logger.info(f"Using instance_id={instance_id!r}")

    # 构建 task params（传给 content script 的参数）
    params = {
        "caption": caption,
        "videoDuration": duration_ms,
        "videoWidth": width,
        "videoHeight": height,
        "disableComments": disable_comments,
        "shareToThreads": share_to_threads,
    }
    if thumbnail_base64:
        params["thumbnailBase64"] = thumbnail_base64

    task_id = None
    try:
        # 1. 创建 Task
        logger.info("Creating task ig.publish_video...")
        task_id = client.task_client.create_task(
            client_name="tweetClaw",
            instance_id=instance_id,
            task_kind="ig.publish_video",
            input_mode="chunked_binary",
            params=params,
        )
        logger.info(f"Task created: taskId={task_id}")

        # 2. 分片上传视频
        logger.info("Uploading video in chunks (5 MB each)...")
        uploader = ChunkedUploader(client.task_client, chunk_size=5 * 1024 * 1024)

        def on_progress(uploaded, total):
            pct = uploaded / total * 100
            logger.info(f"  Upload progress: {uploaded}/{total} parts ({pct:.0f}%)")

        total_parts, total_bytes, content_type = uploader.upload_file(
            task_id, video_path, progress_callback=on_progress
        )
        logger.info(f"Upload complete: parts={total_parts} bytes={total_bytes} type={content_type}")

        # 3. Seal input
        logger.info("Sealing input...")
        client.task_client.seal_input(task_id, total_parts, total_bytes, content_type)

        # 4. Start task
        logger.info("Starting task (dispatching to Instagram content script)...")
        client.task_client.start_task(task_id)

        # 5. Poll for completion
        logger.info("Waiting for completion (IG chunked upload + configure_to_clips polling)...")
        start = time.time()

        def on_task_progress(state, phase, progress):
            elapsed = time.time() - start
            logger.info(f"  Task progress: state={state} phase={phase} progress={progress:.0%} elapsed={elapsed:.0f}s")

        client.task_client.wait_for_completion(
            task_id,
            poll_interval=3.0,
            timeout=600.0,
            progress_callback=on_task_progress,
        )

        # 6. Get result
        result_bytes = client.task_client.get_task_result(task_id)
        result = json.loads(result_bytes)
        elapsed = time.time() - start
        logger.info(f"Task completed in {elapsed:.0f}s")
        return result

    except Exception as e:
        logger.error(f"Task failed: {e}")
        if task_id:
            try:
                client.task_client.cancel_task(task_id)
                logger.info(f"Task {task_id} cancelled")
            except Exception:
                pass
        raise


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    video_path = sys.argv[1]
    caption = sys.argv[2]
    thumbnail_path = sys.argv[3] if len(sys.argv) > 3 else None

    print(f"\n{'='*60}")
    print("Instagram Large Video Upload (Task API)")
    print(f"{'='*60}")
    print(f"Video:     {video_path}")
    print(f"Caption:   {caption}")
    print(f"Thumbnail: {thumbnail_path or '(auto-generate)'}")
    print(f"{'='*60}\n")

    try:
        result = post_video_large(
            video_path=video_path,
            caption=caption,
            thumbnail_path=thumbnail_path,
        )

        media = result.get("media", {})
        media_id = media.get("id") or media.get("pk")
        code = media.get("code")

        print(f"\n{'='*60}")
        print("Upload succeeded!")
        print(f"Media ID:  {media_id}")
        print(f"Shortcode: {code}")
        if code:
            print(f"URL:       https://www.instagram.com/reel/{code}/")
        print(f"Full result:\n{json.dumps(result, indent=2, ensure_ascii=False)}")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\nUpload failed: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
