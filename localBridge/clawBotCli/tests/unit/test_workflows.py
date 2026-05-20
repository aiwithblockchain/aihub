import unittest
from unittest.mock import Mock

from clawbot.domain.models import AIMessageResult, XTweet, XUser
from clawbot.errors import ParseError
from clawbot.workflows.common import CommonWorkflows


class TestCommonWorkflows(unittest.TestCase):
    def setUp(self):
        self.status = Mock()
        self.read = Mock()
        self.actions = Mock()
        self.tabs = Mock()
        self.ai = Mock()
        self.media = Mock()
        self.workflows = CommonWorkflows(
            status=self.status,
            read=self.read,
            actions=self.actions,
            tabs=self.tabs,
            ai=self.ai,
            media=self.media,
        )

    def test_read_and_like_first_tweet(self):
        self.read.get_first_timeline_tweet.return_value = XTweet(id="tweet1", text="hello")
        self.actions.like.return_value = Mock(success=True)

        result = self.workflows.read_and_like_first_tweet(tab_id=1)

        self.read.get_first_timeline_tweet.assert_called_once_with(tab_id=1)
        self.actions.like.assert_called_once_with("tweet1", tab_id=1)
        self.assertTrue(result.success)

    def test_read_and_like_first_tweet_raises_when_missing(self):
        self.read.get_first_timeline_tweet.return_value = None
        with self.assertRaises(ParseError):
            self.workflows.read_and_like_first_tweet()

    def test_search_and_fetch_profile(self):
        self.read.search_first_user.return_value = XUser(id="u1", screen_name="alice")
        self.read.get_user.return_value = XUser(id="u1", screen_name="alice", name="Alice")

        result = self.workflows.search_and_fetch_profile("AI", tab_id=2)

        self.read.search_first_user.assert_called_once_with(query="AI", tab_id=2)
        self.read.get_user.assert_called_once_with("alice", tab_id=2)
        self.assertEqual(result.name, "Alice")

    def test_reply_to_pinned_tweet(self):
        self.read.get_pinned_tweet.return_value = XTweet(id="tweet2", text="pinned")
        self.actions.reply.return_value = Mock(success=True)

        result = self.workflows.reply_to_pinned_tweet("openclaw", "hi", tab_id=3)

        self.actions.reply.assert_called_once_with("tweet2", "hi")
        self.assertTrue(result.success)

    def test_reply_to_pinned_tweet_raises_when_missing(self):
        self.read.get_pinned_tweet.return_value = None
        with self.assertRaises(ParseError):
            self.workflows.reply_to_pinned_tweet("openclaw", "hi")

    def test_analyze_tweet_and_generate_reply(self):
        self.read.get_tweet.return_value = XTweet(id="tweet3", text="tweet body")
        self.ai.send_message.return_value = AIMessageResult(success=True, content="reply", conversation_id="c1")

        result = self.workflows.analyze_tweet_and_generate_reply("tweet3", "chatgpt", tab_id=4)

        self.read.get_tweet.assert_called_once_with("tweet3", tab_id=4)
        self.ai.send_message.assert_called_once()
        self.assertEqual(result.content, "reply")

    def test_reply_to_pinned_tweet_with_ai(self):
        self.read.get_pinned_tweet.return_value = XTweet(id="tweet4", text="pinned text")
        self.ai.send_message.return_value = AIMessageResult(success=True, content="generated reply")
        self.actions.reply.return_value = Mock(success=True)

        result = self.workflows.reply_to_pinned_tweet_with_ai("openclaw", "chatgpt", tab_id=5)

        self.actions.reply.assert_called_once_with("tweet4", "generated reply")
        self.assertTrue(result.success)

    def test_reply_to_pinned_tweet_with_ai_raises_when_ai_empty(self):
        self.read.get_pinned_tweet.return_value = XTweet(id="tweet4", text="pinned text")
        self.ai.send_message.return_value = AIMessageResult(success=True, content=None)
        with self.assertRaises(ParseError):
            self.workflows.reply_to_pinned_tweet_with_ai("openclaw", "chatgpt")

    def test_post_text_with_media(self):
        self.media.post_tweet.return_value = Mock(success=True)

        result = self.workflows.post_text_with_media("hello", "a.png", "b.png")

        self.media.post_tweet.assert_called_once_with(text="hello", file_paths=("a.png", "b.png"))
        self.assertTrue(result.success)


if __name__ == "__main__":
    unittest.main()
