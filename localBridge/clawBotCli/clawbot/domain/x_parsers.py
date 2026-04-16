"""Parsers for X/Twitter raw responses."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from clawbot.domain.models import XStatus, XTab, XTweet, XUser
from clawbot.errors import ParseError


def _unwrap_data(response: Dict[str, Any]) -> Dict[str, Any]:
    data = response.get("data", {}) if isinstance(response, dict) else {}
    if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
        return data["data"]
    return data if isinstance(data, dict) else {}


def parse_x_status(response: Dict[str, Any]) -> XStatus:
    tabs = []
    for tab in response.get("tabs", []) or []:
        if isinstance(tab, dict):
            tabs.append(
                XTab(
                    tab_id=tab.get("tabId"),
                    title=tab.get("title"),
                    url=tab.get("url"),
                    raw=tab,
                )
            )
    return XStatus(
        has_x_tabs=bool(response.get("hasXTabs")),
        is_logged_in=bool(response.get("isLoggedIn")),
        tabs=tabs,
        raw=response,
    )


def parse_basic_user(response: Dict[str, Any]) -> XUser:
    data = _unwrap_data(response)
    user_result = data.get("viewer", {}).get("user_results", {}).get("result", {})
    if not user_result:
        user_result = data.get("user", {}).get("result", {})
    legacy = user_result.get("legacy", {}) if isinstance(user_result, dict) else {}
    return XUser(
        id=user_result.get("rest_id"),
        name=legacy.get("name"),
        screen_name=legacy.get("screen_name"),
        description=legacy.get("description"),
        raw=response,
    )


def parse_user_profile(response: Dict[str, Any]) -> XUser:
    data = _unwrap_data(response)
    user_result = data.get("user", {}).get("result", {})
    legacy = user_result.get("legacy", {}) if isinstance(user_result, dict) else {}
    return XUser(
        id=user_result.get("rest_id"),
        name=legacy.get("name"),
        screen_name=legacy.get("screen_name"),
        description=legacy.get("description"),
        raw=response,
    )


def parse_tweet_result(result: Dict[str, Any]) -> XTweet:
    legacy = result.get("legacy", {}) if isinstance(result, dict) else {}
    core = result.get("core", {}) if isinstance(result, dict) else {}
    user_result = core.get("user_results", {}).get("result", {}) if isinstance(core, dict) else {}
    user_legacy = user_result.get("legacy", {}) if isinstance(user_result, dict) else {}
    return XTweet(
        id=result.get("rest_id"),
        text=legacy.get("full_text") or legacy.get("text"),
        author_id=user_result.get("rest_id"),
        author_name=user_legacy.get("name"),
        author_screen_name=user_legacy.get("screen_name"),
        raw=result,
    )


def extract_timeline_tweets(response: Dict[str, Any]) -> List[XTweet]:
    data = _unwrap_data(response)
    instructions = data.get("home", {}).get("home_timeline_urt", {}).get("instructions", [])
    tweets: List[XTweet] = []
    for instruction in instructions:
        if instruction.get("type") != "TimelineAddEntries":
            continue
        for entry in instruction.get("entries", []):
            if "tweet-" not in entry.get("entryId", ""):
                continue
            result = (
                entry.get("content", {})
                .get("itemContent", {})
                .get("tweet_results", {})
                .get("result", {})
            )
            if result:
                tweets.append(parse_tweet_result(result))
    return tweets


def extract_first_timeline_tweet(response: Dict[str, Any]) -> Optional[XTweet]:
    tweets = extract_timeline_tweets(response)
    return tweets[0] if tweets else None


def extract_search_tweets_and_users(response: Dict[str, Any]) -> Tuple[List[XTweet], List[XUser]]:
    data = _unwrap_data(response)
    instructions = (
        data.get("search_by_raw_query", {})
        .get("search_timeline", {})
        .get("timeline", {})
        .get("instructions", [])
    )
    tweets: List[XTweet] = []
    users: List[XUser] = []
    for instruction in instructions:
        if instruction.get("type") != "TimelineAddEntries":
            continue
        for entry in instruction.get("entries", []):
            result = (
                entry.get("content", {})
                .get("itemContent", {})
                .get("tweet_results", {})
                .get("result", {})
            )
            if not result:
                continue
            tweet = parse_tweet_result(result)
            tweets.append(tweet)
            if tweet.author_id or tweet.author_screen_name:
                users.append(
                    XUser(
                        id=tweet.author_id,
                        name=tweet.author_name,
                        screen_name=tweet.author_screen_name,
                        raw=result,
                    )
                )
    return tweets, users


def extract_pinned_tweet_id_from_profile(response: Dict[str, Any]) -> Optional[str]:
    data = _unwrap_data(response)
    user_result = data.get("user", {}).get("result", {})
    legacy = user_result.get("legacy", {}) if isinstance(user_result, dict) else {}
    pinned_ids = legacy.get("pinned_tweet_ids_str", [])
    if pinned_ids:
        return pinned_ids[0]
    return None


def require_tweet_id(tweet: Optional[XTweet]) -> str:
    if not tweet or not tweet.id:
        raise ParseError("No tweet id could be extracted from response")
    return tweet.id
