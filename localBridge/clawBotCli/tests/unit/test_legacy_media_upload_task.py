#!/usr/bin/env python3
"""Unit test for backward-compatible media upload wrapper."""

import os
import tempfile
import unittest
from unittest.mock import Mock

from clawbot.errors import MediaUploadError
from utils.api_client import MediaUploadTask


class TestLegacyMediaUploadTask(unittest.TestCase):
    def setUp(self):
        self.task_client = Mock()
        self.uploader = Mock()
        self.progress = Mock()
        self.media_upload = MediaUploadTask(self.task_client, self.uploader, self.progress)
        with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".mp4") as handle:
            handle.write(b"test-data")
            self.video_path = handle.name

    def tearDown(self):
        if os.path.exists(self.video_path):
            os.unlink(self.video_path)

    def test_upload_video_success(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'

        media_id = self.media_upload.upload_video(self.video_path, instance_id="instance_xxx", tab_id=123)

        self.assertEqual(media_id, "media_456")
        self.task_client.create_task.assert_called_once()
        self.task_client.seal_input.assert_called_once()
        self.task_client.start_task.assert_called_once()

    def test_upload_video_failure(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.side_effect = MediaUploadError("Network error")

        with self.assertRaises(MediaUploadError):
            self.media_upload.upload_video(self.video_path, instance_id="instance_xxx", tab_id=123)


if __name__ == "__main__":
    unittest.main()
