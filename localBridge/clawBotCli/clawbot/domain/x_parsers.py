"""Parsers for X/Twitter raw responses."""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional, Tuple

from clawbot.domain.models import XStatus, XTab, XTweet, XUser
from clawbot.errors import ParseError


def _unwrap_data(response: Dict[str, Any]) -> Dict[str, Any]:
    data = response.get("data", {}) if isinstance(response, dict) else {}
    if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
        return data["data"]
    return data if isinstance(data, dict) else {}


def _unwrap_tweet_result(result: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {}
    if result.get("__typename") == "TweetWithVisibilityResults" and isinstance(result.get("tweet"), dict):
        return result["tweet"]
    return result


def _extract_entry_tweet_result(entry: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(entry, dict):
        return {}
    item_content = entry.get("itemContent", {}) if isinstance(entry.get("itemContent"), dict) else {}
    if not item_content:
        content = entry.get("content", {}) if isinstance(entry.get("content"), dict) else {}
        item_content = content.get("itemContent", {}) if isinstance(content.get("itemContent"), dict) else {}
    result = item_content.get("tweet_results", {}).get("result", {}) if isinstance(item_content, dict) else {}
    return _unwrap_tweet_result(result)


def _iter_tweet_detail_entries(response: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
    data = _unwrap_data(response)
    instructions = data.get("threaded_conversation_with_injections_v2", {}).get("instructions", [])
    for instruction in instructions:
        for entry in instruction.get("entries", []) or []:
            if not isinstance(entry, dict):
                continue
            yield entry
            content = entry.get("content", {})
            items = content.get("items", []) if isinstance(content, dict) else []
            for item in items:
                nested_entry = item.get("item") if isinstance(item, dict) else None
                if isinstance(nested_entry, dict):
                    yield nested_entry


def _is_promoted_entry(entry: Dict[str, Any]) -> bool:
    entry_id = entry.get("entryId", "") if isinstance(entry, dict) else ""
    content = entry.get("content", {}) if isinstance(entry, dict) else {}
    item_content = content.get("itemContent", {}) if isinstance(content, dict) else {}
    return "promoted-" in entry_id or "promotedMetadata" in item_content


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
    result = _unwrap_tweet_result(result)
    legacy = result.get("legacy", {}) if isinstance(result, dict) else {}
    core = result.get("core", {}) if isinstance(result, dict) else {}
    user_result = core.get("user_results", {}).get("result", {}) if isinstance(core, dict) else {}
    user_legacy = user_result.get("legacy", {}) if isinstance(user_result, dict) else {}
    user_core = user_result.get("core", {}) if isinstance(user_result, dict) else {}
    return XTweet(
        id=result.get("rest_id"),
        text=legacy.get("full_text") or legacy.get("text"),
        author_id=user_result.get("rest_id"),
        author_name=user_legacy.get("name") or user_core.get("name"),
        author_screen_name=user_legacy.get("screen_name") or user_core.get("screen_name"),
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


def extract_focal_tweet(response: Dict[str, Any], tweet_id: str) -> Optional[XTweet]:
    for entry in _iter_tweet_detail_entries(response):
        if _is_promoted_entry(entry):
            continue
        result = _extract_entry_tweet_result(entry)
        if result.get("rest_id") == tweet_id:
            return parse_tweet_result(result)
    return None


def extract_tweet_detail_replies(response: Dict[str, Any], tweet_id: Optional[str] = None) -> List[XTweet]:
    tweets: List[XTweet] = []
    seen_ids: set[str] = set()

    for entry in _iter_tweet_detail_entries(response):
        if _is_promoted_entry(entry):
            continue
        result = _extract_entry_tweet_result(entry)
        rest_id = result.get("rest_id")
        if not rest_id or rest_id == tweet_id or rest_id in seen_ids:
            continue
        seen_ids.add(rest_id)
        tweets.append(parse_tweet_result(result))

    return tweets


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
