#!/usr/bin/env python3
"""Test XHS API 13: post_comment (发布/回复评论)
Usage:
  python3 examples/xhs_test_13_post_comment.py <note_id> <content>
  python3 examples/xhs_test_13_post_comment.py <note_id> <content> <target_comment_id>  # 回复评论
  python3 examples/xhs_test_13_post_comment.py <note_id> <content> <target_comment_id> <at_user_id> <at_nickname>  # 回复并@用户
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) < 3:
    print("Usage: python3 examples/xhs_test_13_post_comment.py <note_id> <content> [target_comment_id] [at_user_id] [at_nickname]")
    print("  note_id: The note ID to comment on")
    print("  content: Comment text")
    print("  target_comment_id: (optional) Comment ID to reply to")
    print("  at_user_id: (optional) User ID to @mention")
    print("  at_nickname: (optional) Nickname of the user to @mention")
    sys.exit(1)

note_id = sys.argv[1]
content = sys.argv[2]
target_comment_id = sys.argv[3] if len(sys.argv) >= 4 else None
at_user_id = sys.argv[4] if len(sys.argv) >= 5 else None
at_nickname = sys.argv[5] if len(sys.argv) >= 6 else None

# 构建 at_users 列表 - 需要是对象数组，不是字符串数组
at_users = []
if at_user_id and at_nickname:
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
