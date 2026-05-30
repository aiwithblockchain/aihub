#!/usr/bin/env python3
"""Test XHS API 13: post_comment (发布/回复评论)
Usage:
  python3 examples/xhs_test_13_post_comment.py <note_id> <content>
  python3 examples/xhs_test_13_post_comment.py <note_id> <content> <target_comment_id>
  python3 examples/xhs_test_13_post_comment.py <note_id> <content> <target_comment_id> <at_nickname>
  python3 examples/xhs_test_13_post_comment.py <note_id> <content> <target_comment_id> <at_user_id> <at_nickname>

Examples:
  python3 examples/xhs_test_13_post_comment.py 6a1306ff00000000070121d5 "普通评论"
  python3 examples/xhs_test_13_post_comment.py 6a1306ff00000000070121d5 " @大梦 测试评论" "" "大梦"
  python3 examples/xhs_test_13_post_comment.py 6a1306ff00000000070121d5 " @大梦 测试评论" "" "5f342d62000000000100976f_524d15d065e375d3ffa22f6a0c352e8a" "大梦"
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


client = ClawBotClient()


def print_usage() -> None:
    print("Usage: python3 examples/xhs_test_13_post_comment.py <note_id> <content> [target_comment_id] [at_nickname|at_user_id] [at_nickname]")
    print("  note_id: The note ID to comment on")
    print("  content: Comment text")
    print("  target_comment_id: (optional) Comment ID to reply to")
    print("  at_nickname: (optional) Nickname to resolve from intimacy_list")
    print("  at_user_id: (optional) Full userid with suffix, used together with at_nickname")


def resolve_at_user_by_nickname(nickname: str) -> dict:
    result = client.xhs.get_intimacy_list()
    if not result.get("success"):
        raise RuntimeError(f"Failed to get intimacy list: {result.get('error', 'Unknown error')}")

    items = result.get("data", {}).get("items", [])
    matches = [item for item in items if item.get("nickname") == nickname]

    if not matches:
        partial_matches = [item for item in items if nickname in item.get("nickname", "")]
        print(f"No exact friend match found for nickname: {nickname}")
        if partial_matches:
            print("Partial matches:")
            for i, item in enumerate(partial_matches[:10], 1):
                print(f"  {i}. {item.get('nickname', '')} | rid={item.get('rid', '')} | userid={item.get('userid', '')}")
        raise RuntimeError("Nickname resolution failed")

    if len(matches) > 1:
        print(f"Found {len(matches)} exact matches for nickname: {nickname}")
        for i, item in enumerate(matches, 1):
            print(f"  {i}. rid={item.get('rid', '')} | userid={item.get('userid', '')}")
        raise RuntimeError("Nickname is ambiguous, please pass at_user_id explicitly")

    match = matches[0]
    resolved = {
        "user_id": match.get("userid", ""),
        "nickname": nickname,
    }
    print(f"Resolved @{nickname} to userid: {resolved['user_id']}")
    return resolved


if len(sys.argv) < 3:
    print_usage()
    sys.exit(1)

note_id = sys.argv[1]
content = sys.argv[2]
target_comment_id = sys.argv[3] if len(sys.argv) >= 4 and sys.argv[3] else None

at_users = []
if len(sys.argv) == 5:
    at_nickname = sys.argv[4]
    if f"@{at_nickname}" not in content:
        print(f"Error: content must include '@{at_nickname}' when using nickname lookup")
        sys.exit(1)
    at_users = [resolve_at_user_by_nickname(at_nickname)]
elif len(sys.argv) >= 6:
    at_user_id = sys.argv[4]
    at_nickname = sys.argv[5]
    if f"@{at_nickname}" not in content:
        print(f"Error: content must include '@{at_nickname}' when using @mention")
        sys.exit(1)
    at_users = [{"user_id": at_user_id, "nickname": at_nickname}]

print("=" * 60)
if target_comment_id:
    print(f"Test: reply to comment (note_id={note_id}, target_comment_id={target_comment_id})")
else:
    print(f"Test: post new comment (note_id={note_id})")
print(f"Content: {content}")
if at_users:
    print(f"At users: {at_users}")
print("=" * 60)

result = client.xhs.post_comment(
    note_id=note_id,
    content=content,
    target_comment_id=target_comment_id,
    at_users=at_users,
)

print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    comment = data.get("comment", {})
    toast = data.get("toast", "")
    print(f"Toast: {toast}")
    print(f"Comment ID: {comment.get('id', 'N/A')}")
    print(f"Content: {comment.get('content', 'N/A')}")
    print(f"Create time: {comment.get('create_time', 'N/A')}")
    print(f"IP location: {comment.get('ip_location', 'N/A')}")
    user_info = comment.get("user_info", {})
    print(f"User: {user_info.get('nickname', 'N/A')} ({user_info.get('user_id', 'N/A')})")
    at_users_result = comment.get("at_users", [])
    if at_users_result:
        print(f"At users in response: {at_users_result}")
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")
