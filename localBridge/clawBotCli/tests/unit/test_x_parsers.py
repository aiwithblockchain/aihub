import unittest

from clawbot.domain.models import XStatus, XTweet, XUser
from clawbot.domain.x_parsers import (
    extract_first_timeline_tweet,
    extract_pinned_tweet_id_from_profile,
    extract_search_tweets_and_users,
    extract_timeline_tweets,
    parse_basic_user,
    parse_user_profile,
    parse_x_status,
)


class TestXParsers(unittest.TestCase):
    def test_parse_x_status(self):
        raw = {
            "hasXTabs": True,
            "isLoggedIn": True,
            "tabs": [{"tabId": 1, "title": "X", "url": "https://x.com/home"}],
        }
        status = parse_x_status(raw)
        self.assertIsInstance(status, XStatus)
        self.assertTrue(status.is_logged_in)
        self.assertEqual(len(status.tabs), 1)
        self.assertEqual(status.tabs[0].tab_id, 1)

    def test_parse_basic_user(self):
        raw = {
            "data": {
                "data": {
                    "viewer": {
                        "user_results": {
                            "result": {
                                "rest_id": "u1",
                                "legacy": {"name": "Alice", "screen_name": "alice", "description": "bio"},
                            }
                        }
                    }
                }
            }
        }
        user = parse_basic_user(raw)
        self.assertIsInstance(user, XUser)
        self.assertEqual(user.id, "u1")
        self.assertEqual(user.screen_name, "alice")

    def test_parse_user_profile(self):
        raw = {
            "data": {
                "data": {
                    "user": {
                        "result": {
                            "rest_id": "u2",
                            "legacy": {"name": "Bob", "screen_name": "bob", "description": "hello"},
                        }
                    }
                }
            }
        }
        user = parse_user_profile(raw)
        self.assertEqual(user.id, "u2")
        self.assertEqual(user.name, "Bob")

    def test_extract_timeline_tweets(self):
        raw = {
            "data": {
                "data": {
                    "home": {
                        "home_timeline_urt": {
                            "instructions": [
                                {
                                    "type": "TimelineAddEntries",
                                    "entries": [
                                        {
                                            "entryId": "tweet-1",
                                            "content": {
                                                "itemContent": {
                                                    "tweet_results": {
                                                        "result": {
                                                            "rest_id": "t1",
                                                            "legacy": {"full_text": "hello world"},
                                                            "core": {
                                                                "user_results": {
                                                                    "result": {
                                                                        "rest_id": "u1",
                                                                        "legacy": {
                                                                            "name": "Alice",
                                                                            "screen_name": "alice",
                                                                        },
                                                                    }
                                                                }
                                                            },
                                                        }
                                                    }
                                                }
                                            },
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                }
            }
        }
        tweets = extract_timeline_tweets(raw)
        self.assertEqual(len(tweets), 1)
        self.assertIsInstance(tweets[0], XTweet)
        self.assertEqual(tweets[0].id, "t1")
        self.assertEqual(tweets[0].author_screen_name, "alice")
        first = extract_first_timeline_tweet(raw)
        self.assertEqual(first.id, "t1")

    def test_extract_search_tweets_and_users(self):
        raw = {
            "data": {
                "data": {
                    "search_by_raw_query": {
                        "search_timeline": {
                            "timeline": {
                                "instructions": [
                                    {
                                        "type": "TimelineAddEntries",
                                        "entries": [
                                            {
                                                "entryId": "tweet-2",
                                                "content": {
                                                    "itemContent": {
                                                        "tweet_results": {
                                                            "result": {
                                                                "rest_id": "t2",
                                                                "legacy": {"full_text": "search result"},
                                                                "core": {
                                                                    "user_results": {
                                                                        "result": {
                                                                            "rest_id": "u2",
                                                                            "legacy": {
                                                                                "name": "Bob",
                                                                                "screen_name": "bob",
                                                                            },
                                                                        }
                                                                    }
                                                                },
                                                            }
                                                        }
                                                    }
                                                },
                                            }
                                        ],
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }
        tweets, users = extract_search_tweets_and_users(raw)
        self.assertEqual(len(tweets), 1)
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0].screen_name, "bob")

    def test_extract_pinned_tweet_id(self):
        raw = {
            "data": {
                "data": {
                    "user": {
                        "result": {
                            "legacy": {"pinned_tweet_ids_str": ["12345"]}
                        }
                    }
                }
            }
        }
        self.assertEqual(extract_pinned_tweet_id_from_profile(raw), "12345")


if __name__ == "__main__":
    unittest.main()
