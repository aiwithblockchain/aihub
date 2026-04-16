import unittest

from clawbot.domain.x_parsers import (
    extract_first_timeline_tweet,
    extract_pinned_tweet_id_from_profile,
    extract_search_tweets_and_users,
    extract_timeline_tweets,
    parse_basic_user,
    parse_user_profile,
)


class TestXParserEdgeCases(unittest.TestCase):
    def test_parse_basic_user_missing_fields(self):
        user = parse_basic_user({"data": {"data": {}}})
        self.assertIsNone(user.id)
        self.assertIsNone(user.screen_name)

    def test_parse_user_profile_missing_fields(self):
        user = parse_user_profile({"data": {"data": {}}})
        self.assertIsNone(user.id)
        self.assertIsNone(user.name)

    def test_extract_timeline_tweets_empty(self):
        tweets = extract_timeline_tweets({"data": {"data": {"home": {"home_timeline_urt": {"instructions": []}}}}})
        self.assertEqual(tweets, [])
        self.assertIsNone(extract_first_timeline_tweet({"data": {"data": {"home": {"home_timeline_urt": {"instructions": []}}}}}))

    def test_extract_search_tweets_and_users_empty(self):
        tweets, users = extract_search_tweets_and_users({"data": {"data": {}}})
        self.assertEqual(tweets, [])
        self.assertEqual(users, [])

    def test_extract_pinned_tweet_id_missing(self):
        self.assertIsNone(extract_pinned_tweet_id_from_profile({"data": {"data": {}}}))


if __name__ == "__main__":
    unittest.main()
