#!/usr/bin/env python3
"""Test IG API 8: post_comment (发布评论)

Usage:
  python3 examples/ig_test_8_post_comment.py <media_id> <text> [reply_to_comment_id]

Prerequisites:
  - localBridge is running
  - Chrome extension (tweetClaw) is connected
  - Instagram is open and logged in

Note: This is a WRITE operation. Use with caution.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

# 需要提供 media_id 和 text
if len(sys.argv) < 3:
    print("Usage: python3 examples/ig_test_8_post_comment.py <media_id> <text> [reply_to_comment_id]")
    print("Example: python3 examples/ig_test_8_post_comment.py 1234567890 'Great post!'")
    print("Example (reply): python3 examples/ig_test_8_post_comment.py 1234567890 'Thanks!' 987654321")
    sys.exit(1)

media_id = sys.argv[1]
text = sys.argv[2]
reply_to_comment_id = sys.argv[3] if len(sys.argv) > 3 else None

print("=" * 60)
print(f"Test: ig_post_comment (发布评论)")
print(f"Media ID: {media_id}")
print(f"Text: {text}")
if reply_to_comment_id:
    print(f"Reply to: {reply_to_comment_id}")
print("=" * 60)
print("⚠️  WARNING: This is a WRITE operation. Press Ctrl+C to cancel.")
print()

result = client.ig.post_comment(
    media_id=media_id,
    text=text,
    replied_to_comment_id=reply_to_comment_id,
)

# Go REST API 直接返回 payload，不包装 success/data
comment = result.get("comment", {})
print(f"Comment ID:     {comment.get('pk')}")
print(f"Text:           {comment.get('text')}")
print()
print("Full response:")
print(json.dumps(result, ensure_ascii=False, indent=2))