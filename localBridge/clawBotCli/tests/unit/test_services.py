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

    def test_x_read_get_tweet_returns_focal_tweet_not_first_reply(self):
        transport = Mock()
        transport.get_tweet_raw.return_value = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "conversationthread-root",
                                        "content": {
                                            "items": [
                                                {
                                                    "item": {
                                                        "entryId": "conversationthread-reply-tweet-reply-1",
                                                        "content": {
                                                            "itemContent": {
                                                                "tweet_results": {
                                                                    "result": {
                                                                        "rest_id": "reply-1",
                                                                        "legacy": {"full_text": "reply tweet"},
                                                                    }
                                                                }
                                                            }
                                                        },
                                                    }
                                                },
                                                {
                                                    "item": {
                                                        "entryId": "conversationthread-root-tweet-root-1",
                                                        "content": {
                                                            "itemContent": {
                                                                "tweet_results": {
                                                                    "result": {
                                                                        "rest_id": "root-1",
                                                                        "legacy": {"full_text": "target tweet"},
                                                                    }
                                                                }
                                                            }
                                                        },
                                                    }
                                                },
                                            ]
                                        },
                                    }
                                ],
                            }
                        ]
                    }
                }
            }
        }
        service = XReadService(transport)
        tweet = service.get_tweet("root-1", instance_id="instance-1")
        self.assertIsInstance(tweet, XTweet)
        self.assertEqual(tweet.id, "root-1")
        self.assertEqual(tweet.text, "target tweet")
        transport.get_tweet_raw.assert_called_once_with(tweet_id="root-1", tab_id=None, instance_id="instance-1")

    def test_x_read_get_tweet_replies_skips_focal_tweet(self):
        transport = Mock()
        transport.get_tweet_replies_raw.return_value = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "conversationthread-root",
                                        "content": {
                                            "items": [
                                                {
                                                    "item": {
                                                        "entryId": "conversationthread-root-tweet-root-1",
                                                        "content": {
                                                            "itemContent": {
                                                                "tweet_results": {
                                                                    "result": {
                                                                        "rest_id": "root-1",
                                                                        "legacy": {"full_text": "target tweet"},
                                                                    }
                                                                }
                                                            }
                                                        },
                                                    }
                                                },
                                                {
                                                    "item": {
                                                        "entryId": "conversationthread-reply-tweet-reply-1",
                                                        "content": {
                                                            "itemContent": {
                                                                "tweet_results": {
                                                                    "result": {
                                                                        "rest_id": "reply-1",
                                                                        "legacy": {"full_text": "reply tweet"},
                                                                    }
                                                                }
                                                            }
                                                        },
                                                    }
                                                },
                                            ]
                                        },
                                    }
                                ],
                            }
                        ]
                    }
                }
            }
        }
        service = XReadService(transport)
        tweets = service.get_tweet_replies("root-1", instance_id="instance-1")
        self.assertEqual([tweet.id for tweet in tweets], ["reply-1"])
        transport.get_tweet_replies_raw.assert_called_once_with(
            tweet_id="root-1", cursor=None, tab_id=None, instance_id="instance-1"
        )

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
