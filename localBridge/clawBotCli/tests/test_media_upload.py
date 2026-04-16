import sys
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot.errors import MediaUploadError
from utils.task_client import TaskClient
from utils.chunked_uploader import ChunkedUploader
from utils.progress_display import ProgressDisplay
from utils.api_client import MediaUploadTask

class TestMediaUploadTask(unittest.TestCase):

    def setUp(self):
        self.task_client = Mock(spec=TaskClient)
        self.uploader = Mock(spec=ChunkedUploader)
        self.progress = Mock(spec=ProgressDisplay)
        self.media_upload = MediaUploadTask(
            self.task_client,
            self.uploader,
            self.progress
        )
        with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".mp4") as handle:
            handle.write(b"test-data")
            self.video_path = handle.name

    def tearDown(self):
        if os.path.exists(self.video_path):
            os.unlink(self.video_path)

    def test_upload_video_success(self):
        """测试视频上传成功"""
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.return_value = {'state': 'completed'}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'

        media_id = self.media_upload.upload_video(
            self.video_path,
            instance_id="instance_xxx",
            tab_id=123
        )

        self.assertEqual(media_id, "media_456")
        self.task_client.create_task.assert_called_once()
        self.task_client.seal_input.assert_called_once()
        self.task_client.start_task.assert_called_once()

    def test_upload_video_failure(self):
        """测试视频上传失败"""
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.side_effect = MediaUploadError('Network error')

        with self.assertRaises(MediaUploadError) as context:
            self.media_upload.upload_video(
                self.video_path,
                instance_id="instance_xxx",
                tab_id=123
            )

        self.assertIn('Network error', str(context.exception))

    def test_upload_video_keyboard_interrupt(self):
        """测试 KeyboardInterrupt 时正确取消任务"""
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")

        # 抛出 KeyboardInterrupt 来模拟用户中断
        self.task_client.wait_for_completion.side_effect = KeyboardInterrupt()

        with self.assertRaises(KeyboardInterrupt):
            self.media_upload.upload_video(
                self.video_path,
                instance_id="instance_xxx",
                tab_id=123
            )

        # 重点断言：必须调用 cancel_task 取消后台队列
        self.task_client.cancel_task.assert_called_once_with("task_123")

if __name__ == '__main__':
    unittest.main()
