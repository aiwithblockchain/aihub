import unittest

from clawbot.domain.models import XStatus, XTweet, XUser
from clawbot.domain.x_parsers import (
    extract_first_timeline_tweet,
    extract_focal_tweet,
    extract_pinned_tweet_id_from_profile,
    extract_search_tweets_and_users,
    extract_timeline_tweets,
    extract_tweet_detail_replies,
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

    def test_parse_basic_user_uses_core_when_legacy_is_missing(self):
        raw = {
            "data": {
                "data": {
                    "user": {
                        "result": {
                            "rest_id": "u2",
                            "core": {"name": "MeshNetProtocol", "screen_name": "1DU1Gf7oElR2h28"},
                        }
                    }
                }
            }
        }
        user = parse_basic_user(raw)
        self.assertEqual(user.id, "u2")
        self.assertEqual(user.name, "MeshNetProtocol")
        self.assertEqual(user.screen_name, "1DU1Gf7oElR2h28")

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

    def test_extract_focal_tweet_prefers_requested_id_over_first_reply(self):
        raw = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "conversationthread-r1",
                                        "content": {
                                            "items": [
                                                {
                                                    "item": {
                                                        "entryId": "conversationthread-r1-tweet-r1",
                                                        "content": {
                                                            "itemContent": {
                                                                "tweet_results": {
                                                                    "result": {
                                                                        "rest_id": "reply-1",
                                                                        "legacy": {"full_text": "reply first"},
                                                                        "core": {
                                                                            "user_results": {
                                                                                "result": {
                                                                                    "rest_id": "u-reply",
                                                                                    "legacy": {"screen_name": "reply_user"},
                                                                                }
                                                                            }
                                                                        },
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
                                                                        "core": {
                                                                            "user_results": {
                                                                                "result": {
                                                                                    "rest_id": "u-root",
                                                                                    "legacy": {"screen_name": "root_user"},
                                                                                }
                                                                            }
                                                                        },
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
        tweet = extract_focal_tweet(raw, "root-1")
        self.assertIsNotNone(tweet)
        self.assertEqual(tweet.id, "root-1")
        self.assertEqual(tweet.author_screen_name, "root_user")

    def test_extract_focal_tweet_unwraps_visibility_wrapper(self):
        raw = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "tweet-target",
                                        "content": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "__typename": "TweetWithVisibilityResults",
                                                        "tweet": {
                                                            "rest_id": "target-1",
                                                            "legacy": {"full_text": "wrapped tweet"},
                                                            "core": {
                                                                "user_results": {
                                                                    "result": {
                                                                        "rest_id": "u1",
                                                                        "legacy": {"screen_name": "wrapped_user"},
                                                                    }
                                                                }
                                                            },
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
        tweet = extract_focal_tweet(raw, "target-1")
        self.assertIsNotNone(tweet)
        self.assertEqual(tweet.id, "target-1")
        self.assertEqual(tweet.text, "wrapped tweet")

    def test_extract_focal_tweet_uses_user_core_when_legacy_fields_are_missing(self):
        raw = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "tweet-target",
                                        "content": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "rest_id": "target-1",
                                                        "legacy": {"full_text": "wrapped tweet"},
                                                        "core": {
                                                            "user_results": {
                                                                "result": {
                                                                    "rest_id": "u1",
                                                                    "core": {
                                                                        "name": "Bybit",
                                                                        "screen_name": "Bybit_Official",
                                                                    },
                                                                    "legacy": {
                                                                        "description": "profile only"
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
        tweet = extract_focal_tweet(raw, "target-1")
        self.assertIsNotNone(tweet)
        self.assertEqual(tweet.author_name, "Bybit")
        self.assertEqual(tweet.author_screen_name, "Bybit_Official")

    def test_extract_tweet_detail_replies_skips_focal_and_promoted(self):
        raw = {
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
                                    },
                                    {
                                        "entryId": "conversationthread-promoted-promoted-tweet-ad-1",
                                        "content": {
                                            "itemContent": {
                                                "promotedMetadata": {"impressionId": "ad-1"},
                                                "tweet_results": {
                                                    "result": {
                                                        "rest_id": "ad-1",
                                                        "legacy": {"full_text": "sponsored"},
                                                    }
                                                },
                                            }
                                        },
                                    },
                                ],
                            }
                        ]
                    }
                }
            }
        }
        tweets = extract_tweet_detail_replies(raw, tweet_id="root-1")
        self.assertEqual([tweet.id for tweet in tweets], ["reply-1"])

    def test_extract_tweet_detail_replies_reads_module_items_with_direct_item_content(self):
        raw = {
            "data": {
                "data": {
                    "threaded_conversation_with_injections_v2": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "tweet-root-1",
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
                                    },
                                    {
                                        "entryId": "conversationthread-reply-1",
                                        "content": {
                                            "items": [
                                                {
                                                    "entryId": "conversationthread-reply-1-tweet-reply-1",
                                                    "item": {
                                                        "itemContent": {
                                                            "tweet_results": {
                                                                "result": {
                                                                    "rest_id": "reply-1",
                                                                    "legacy": {"full_text": "reply tweet"},
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            ]
                                        },
                                    },
                                ],
                            }
                        ]
                    }
                }
            }
        }
        tweets = extract_tweet_detail_replies(raw, tweet_id="root-1")
        self.assertEqual([tweet.id for tweet in tweets], ["reply-1"])

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
