import unittest
from unittest.mock import Mock

from clawbot.domain.models import MediaUploadResult
from clawbot.errors import MediaUploadError
from clawbot.services.media import MediaService


class TestMediaService(unittest.TestCase):
    def setUp(self):
        self.task_client = Mock()
        self.actions = Mock()
        self.uploader = Mock()
        self.progress = Mock()
        self.media = MediaService(
            task_client=self.task_client,
            actions=self.actions,
            uploader=self.uploader,
            progress=self.progress,
        )

    def test_upload_success(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "video/mp4")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'

        result = self.media.upload(__file__, instance_id="instance_xxx")

        self.assertIsInstance(result, MediaUploadResult)
        self.assertTrue(result.success)
        self.assertEqual(result.media_id, "media_456")

    def test_upload_failure(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "video/mp4")
        self.task_client.wait_for_completion.return_value = {
            "state": "failed",
            "errorMessage": "Network error",
        }

        with self.assertRaises(MediaUploadError):
            self.media.upload(__file__, instance_id="instance_xxx")

    def test_post_tweet_with_media(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "image/png")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'
        self.actions.create_tweet.return_value = Mock(success=True)

        self.media.post_tweet("hello", [__file__], instance_id="instance_xxx")

        self.actions.create_tweet.assert_called_once_with(text="hello", media_ids=["media_456"])

        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "image/png")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'
        self.actions.reply.return_value = Mock(success=True)

        self.media.reply_with_media("tweet_1", "hello", [__file__], instance_id="instance_xxx")

        self.actions.reply.assert_called_once()


if __name__ == "__main__":
    unittest.main()
