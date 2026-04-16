import unittest
from unittest.mock import Mock, patch

from clawbot.client import ClawBotClient


class TestClawBotClient(unittest.TestCase):
    @patch("clawbot.client.XApiTransport")
    @patch("clawbot.client.AIApiTransport")
    @patch("clawbot.client.TaskApiTransport")
    def test_client_initializes_service_tree(self, task_transport_cls, ai_transport_cls, x_transport_cls):
        x_transport_cls.return_value = Mock()
        ai_transport_cls.return_value = Mock()
        task_transport_cls.return_value = Mock()

        client = ClawBotClient(base_url="http://localhost:10088", timeout=10)

        self.assertTrue(hasattr(client, "x"))
        self.assertTrue(hasattr(client, "ai"))
        self.assertTrue(hasattr(client, "media"))
        self.assertTrue(hasattr(client, "workflows"))
        self.assertTrue(hasattr(client.x, "status"))
        self.assertTrue(hasattr(client.x, "timeline"))
        self.assertTrue(hasattr(client.x, "actions"))
        self.assertTrue(hasattr(client.ai, "chat"))


if __name__ == "__main__":
    unittest.main()
