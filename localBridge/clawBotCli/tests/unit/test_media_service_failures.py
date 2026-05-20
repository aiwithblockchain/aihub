import unittest
from unittest.mock import Mock

from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError
from clawbot.services.media import MediaService


class TestMediaServiceFailures(unittest.TestCase):
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

    def test_upload_raises_when_file_missing(self):
        with self.assertRaises(MediaUploadError):
            self.media.upload("/tmp/definitely-missing-clawbot-file.png", instance_id="instance_xxx")

    def test_upload_raises_when_result_missing_media_id(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "video/mp4")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b"{}"

        with self.assertRaises(MediaUploadError):
            self.media.upload(__file__, instance_id="instance_xxx")

        self.task_client.cancel_task.assert_called_once_with("task_123")

    def test_upload_raises_when_result_is_invalid_json(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "video/mp4")
        self.task_client.wait_for_completion.return_value = {"state": "completed"}
        self.task_client.get_task_result.return_value = b"not-json"

        with self.assertRaises(ParseError):
            self.media.upload(__file__, instance_id="instance_xxx")

        self.task_client.cancel_task.assert_called_once_with("task_123")

    def test_upload_propagates_task_timeout_error(self):
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (3, 100, "video/mp4")
        self.task_client.wait_for_completion.side_effect = TaskTimeoutError("timeout")

        with self.assertRaises(TaskTimeoutError):
            self.media.upload(__file__, instance_id="instance_xxx")

        self.task_client.cancel_task.assert_called_once_with("task_123")

    def test_upload_many_stops_on_first_failure(self):
        self.media.upload = Mock(side_effect=[Mock(media_id="media_1"), MediaUploadError("boom")])

        with self.assertRaises(MediaUploadError):
            self.media.upload_many(["a.png", "b.png"], instance_id="instance_xxx")

        self.assertEqual(self.media.upload.call_count, 2)

    def test_post_tweet_does_not_call_action_when_upload_fails(self):
        self.media.upload_many = Mock(side_effect=MediaUploadError("boom"))

        with self.assertRaises(MediaUploadError):
            self.media.post_tweet("hello", ["a.png"], instance_id="instance_xxx")

        self.actions.create_tweet.assert_not_called()

    def test_reply_with_media_does_not_call_action_when_upload_fails(self):
        self.media.upload_many = Mock(side_effect=MediaUploadError("boom"))

        with self.assertRaises(MediaUploadError):
            self.media.reply_with_media("tweet_1", "hello", ["a.png"], instance_id="instance_xxx")

        self.actions.reply.assert_not_called()

    def test_post_tweet_propagates_action_error(self):
        self.media.upload_many = Mock(return_value=[Mock(media_id="media_1")])
        self.actions.create_tweet.side_effect = RuntimeError("action failed")

        with self.assertRaises(RuntimeError):
            self.media.post_tweet("hello", ["a.png"], instance_id="instance_xxx")

    def test_reply_with_media_propagates_action_error(self):
        self.media.upload_many = Mock(return_value=[Mock(media_id="media_1")])
        self.actions.reply.side_effect = RuntimeError("action failed")

        with self.assertRaises(RuntimeError):
            self.media.reply_with_media("tweet_1", "hello", ["a.png"], instance_id="instance_xxx")

        self.media.upload_many = Mock(
            return_value=[
                Mock(media_id="media_1"),
                Mock(media_id=None),
                Mock(media_id="media_2"),
            ]
        )
        self.actions.create_tweet.return_value = Mock(success=True)

        self.media.post_tweet("hello", ["a.png", "b.png", "c.png"], instance_id="instance_xxx")

        self.actions.create_tweet.assert_called_once_with(text="hello", media_ids=["media_1", "media_2"])

    def test_reply_with_media_passes_uploaded_media_ids_to_action(self):
        self.media.upload_many = Mock(
            return_value=[
                Mock(media_id="media_1"),
                Mock(media_id=None),
                Mock(media_id="media_2"),
            ]
        )
        self.actions.reply.return_value = Mock(success=True)

        self.media.reply_with_media("tweet_1", "hello", ["a.png", "b.png", "c.png"], instance_id="instance_xxx")

        self.actions.reply.assert_called_once_with(tweet_id="tweet_1", text="hello", media_ids=["media_1", "media_2"])


if __name__ == "__main__":
    unittest.main()
