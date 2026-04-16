import os
import tempfile
import unittest
from unittest.mock import Mock

from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError
from clawbot.upload.task_client import TaskApiClient


class TestTaskApiClientFailures(unittest.TestCase):
    def setUp(self):
        self.transport = Mock()
        self.client = TaskApiClient(self.transport, config_path="/tmp/nonexistent-clawbot-config.json")

    def test_load_config_returns_empty_dict_when_file_missing(self):
        client = TaskApiClient(self.transport, config_path="/tmp/nonexistent-clawbot-config.json")

        self.assertEqual(client.config, {})

    def test_load_config_raises_parse_error_on_invalid_json(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            handle.write("{invalid-json")
            config_path = handle.name

        try:
            with self.assertRaises(ParseError):
                TaskApiClient(self.transport, config_path=config_path)
        finally:
            os.unlink(config_path)

    def test_create_task_raises_when_task_id_missing(self):
        self.transport.create_task_raw.return_value = {}

        with self.assertRaises(ParseError):
            self.client.create_task("tweetClaw", "instance_1", "x.media_upload", "chunked_binary", {})

    def test_wait_for_completion_raises_when_state_missing(self):
        self.transport.get_task_status_raw.return_value = {}

        with self.assertRaises(ParseError):
            self.client.wait_for_completion("task_1", poll_interval=0, timeout=1)

    def test_wait_for_completion_raises_on_failed_state(self):
        self.transport.get_task_status_raw.return_value = {
            "state": "failed",
            "errorMessage": "upload failed",
        }

        with self.assertRaises(MediaUploadError):
            self.client.wait_for_completion("task_1", poll_interval=0, timeout=1)

    def test_wait_for_completion_raises_on_cancelled_state(self):
        self.transport.get_task_status_raw.return_value = {"state": "cancelled"}

        with self.assertRaises(MediaUploadError):
            self.client.wait_for_completion("task_1", poll_interval=0, timeout=1)

    def test_wait_for_completion_times_out_and_cancels_task(self):
        self.transport.get_task_status_raw.return_value = {"state": "running", "progress": 10}

        with self.assertRaises(TaskTimeoutError):
            self.client.wait_for_completion("task_1", poll_interval=0, timeout=0)

        self.transport.cancel_task_raw.assert_called_once_with("task_1")


if __name__ == "__main__":
    unittest.main()
