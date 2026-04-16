import unittest
from unittest.mock import Mock

from clawbot.domain.models import AIMessageResult, XStatus, XTweet, XUser
from clawbot.services.ai_chat import AIChatService
from clawbot.services.x_actions import XActionsService
from clawbot.services.x_read import XReadService
from clawbot.services.x_status import XStatusService


class TestServices(unittest.TestCase):
    def test_x_status_service(self):
        transport = Mock()
        transport.get_status_raw.return_value = {
            "hasXTabs": True,
            "isLoggedIn": True,
            "tabs": [{"tabId": 7}],
        }
        service = XStatusService(transport)
        status = service.get_status()
        self.assertIsInstance(status, XStatus)
        self.assertEqual(service.get_default_tab_id(), 7)

    def test_x_actions_create_tweet(self):
        transport = Mock()
        transport.create_tweet_raw.return_value = {
            "data": {
                "data": {
                    "create_tweet": {
                        "tweet_results": {"result": {"rest_id": "tweet123"}}
                    }
                }
            }
        }
        service = XActionsService(transport)
        result = service.create_tweet("hello")
        self.assertTrue(result.success)
        self.assertEqual(result.target_id, "tweet123")

    def test_x_read_get_user(self):
        transport = Mock()
        transport.get_user_profile_raw.return_value = {
            "data": {
                "data": {
                    "user": {
                        "result": {
                            "rest_id": "u1",
                            "legacy": {"name": "Alice", "screen_name": "alice"},
                        }
                    }
                }
            }
        }
        service = XReadService(transport)
        user = service.get_user("alice")
        self.assertIsInstance(user, XUser)
        self.assertEqual(user.screen_name, "alice")

    def test_ai_chat_send_message(self):
        transport = Mock()
        transport.send_message_raw.return_value = {
            "success": True,
            "content": "42",
            "conversationId": "conv1",
        }
        service = AIChatService(transport)
        result = service.send_message("chatgpt", "say 42")
        self.assertIsInstance(result, AIMessageResult)
        self.assertEqual(result.content, "42")


if __name__ == "__main__":
    unittest.main()
