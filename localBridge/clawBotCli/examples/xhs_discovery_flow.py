#!/usr/bin/env python3
"""
XHS Discovery Flow Example

Scenario: Discover trending content and explore user profiles
- Get homefeed to discover trending notes
- Extract note_id and user_id from feed
- Get note details and comments
- Get user info and their other notes
- Search for related topics
"""

import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def print_json(data, max_items=3):
    """Print JSON data with optional truncation for lists."""
    if isinstance(data, dict) and 'items' in data and isinstance(data['items'], list):
        truncated = data.copy()
        if len(truncated['items']) > max_items:
            truncated['items'] = truncated['items'][:max_items]
            truncated['_truncated'] = f"Showing {max_items} of {len(data['items'])} items"
        print(json.dumps(truncated, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> int:
    client = ClawBotClient()

    # ═══════════════════════════════════════════════════════════
    # Step 1: Get Account Info
    # ═══════════════════════════════════════════════════════════
    print_section("Step 1: Get My Account Info")
    account = client.xhs.get_account_info()

    if account.get('success'):
        data = account.get('data', {})
        print(f"✓ Logged in as: {data.get('nickname')} (@{data.get('red_id')})")
        print(f"  User ID: {data.get('user_id')}")
        print(f"  Bio: {data.get('desc')}")
    else:
        print(f"✗ Failed to get account info: {account}")
        return 1

    # ═══════════════════════════════════════════════════════════
    # Step 2: Get Homefeed to Discover Content
    # ═══════════════════════════════════════════════════════════
    print_section("Step 2: Get Homefeed (Discover Trending Notes)")
    feed = client.xhs.get_homefeed()

    if not feed.get('success'):
        print(f"✗ Failed to get homefeed: {feed}")
        return 1

    items = feed.get('data', {}).get('items', [])
    cursor_score = feed.get('data', {}).get('cursor_score')

    print(f"✓ Found {len(items)} notes in feed")
    print(f"  Next cursor: {cursor_score}")

    # Extract first note for detailed exploration
    if not items:
        print("✗ No items in feed")
        return 1

    first_note = items[0]
    note_id = first_note.get('id')
    note_card = first_note.get('note_card', {})
    note_title = note_card.get('display_title', 'No title')
    note_user = note_card.get('user', {})
    user_id = note_user.get('user_id')
    user_nickname = note_user.get('nickname')

    print(f"\n📝 First note details:")
    print(f"  Note ID: {note_id}")
    print(f"  Title: {note_title}")
    print(f"  Author: {user_nickname} (ID: {user_id})")
    print(f"  Likes: {note_card.get('interact_info', {}).get('liked_count', 0)}")

    # ═══════════════════════════════════════════════════════════
    # Step 3: Get Note Comments
    # ═══════════════════════════════════════════════════════════
    print_section(f"Step 3: Get Comments for Note '{note_title}'")
    comments = client.xhs.get_note_comments(note_id=note_id)

    if comments.get('success'):
        comment_data = comments.get('data', {})
        comment_list = comment_data.get('comments', [])
        print(f"✓ Found {len(comment_list)} comments")

        if comment_list:
            print(f"\n💬 First comment:")
            first_comment = comment_list[0]
            print(f"  User: {first_comment.get('user_info', {}).get('nickname')}")
            print(f"  Content: {first_comment.get('content')}")
            print(f"  Likes: {first_comment.get('like_count', 0)}")
    else:
        print(f"⚠ Could not get comments: {comments.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 4: Get User Info
    # ═══════════════════════════════════════════════════════════
    print_section(f"Step 4: Get User Info for '{user_nickname}'")
    user_info = client.xhs.get_user_info(user_id=user_id)

    if user_info.get('success'):
        user_data = user_info.get('data', {})
        print(f"✓ User profile:")
        print(f"  Nickname: {user_data.get('basic_info', {}).get('nickname')}")
        print(f"  Red ID: {user_data.get('basic_info', {}).get('red_id')}")
        print(f"  Followers: {user_data.get('interact_info', {}).get('follower_count', 0)}")
        print(f"  Following: {user_data.get('interact_info', {}).get('followed_count', 0)}")
        print(f"  Notes: {user_data.get('interact_info', {}).get('note_count', 0)}")
    else:
        print(f"⚠ Could not get user info: {user_info.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 5: Get User's Other Notes
    # ═══════════════════════════════════════════════════════════
    print_section(f"Step 5: Get Other Notes by '{user_nickname}'")
    user_notes = client.xhs.get_user_notes(user_id=user_id)

    if user_notes.get('success'):
        notes_data = user_notes.get('data', {})
        notes_list = notes_data.get('notes', [])
        print(f"✓ Found {len(notes_list)} notes by this user")

        if notes_list:
            print(f"\n📚 Recent notes:")
            for i, note in enumerate(notes_list[:3], 1):
                print(f"  {i}. {note.get('display_title', 'No title')}")
                print(f"     Likes: {note.get('interact_info', {}).get('liked_count', 0)}")
    else:
        print(f"⚠ Could not get user notes: {user_notes.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 6: Search Related Topics
    # ═══════════════════════════════════════════════════════════
    print_section("Step 6: Search Topics Related to First Note")

    # Extract a keyword from note title for topic search
    search_keyword = note_title.split()[0] if note_title else "生活"
    topics = client.xhs.search_topics(keyword=search_keyword)

    if topics.get('success'):
        topic_data = topics.get('data', {})
        topic_list = topic_data.get('topics', [])
        print(f"✓ Found {len(topic_list)} topics for '{search_keyword}'")

        if topic_list:
            print(f"\n🏷️  Related topics:")
            for i, topic in enumerate(topic_list[:5], 1):
                print(f"  {i}. #{topic.get('name')} ({topic.get('type')})")
                print(f"     Views: {topic.get('view_count', 0)}")
    else:
        print(f"⚠ Could not search topics: {topics.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════
    print_section("Discovery Flow Complete!")
    print(f"""
✓ Tested APIs:
  1. get_account_info() - Get current user profile
  2. get_homefeed() - Discover trending content
  3. get_note_comments(note_id) - Read note comments
  4. get_user_info(user_id) - Get user profile details
  5. get_user_notes(user_id) - Browse user's content
  6. search_topics(keyword) - Find related topics

📊 Data Flow:
  Homefeed → Extract note_id & user_id → Get details → Explore user → Find topics
    """)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
