#!/usr/bin/env python3
"""
XHS Search and Explore Example

Scenario: Search for content and explore results
- Search notes by keyword
- Get detailed info for search results
- Explore authors of popular notes
- Find related topics
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


def main() -> int:
    client = ClawBotClient()

    # ═══════════════════════════════════════════════════════════
    # Step 1: Search for Content
    # ═══════════════════════════════════════════════════════════
    search_keyword = input("\n🔍 Enter search keyword (default: '美食'): ").strip() or "美食"

    print_section(f"Step 1: Search for '{search_keyword}'")
    search_result = client.xhs.search(keyword=search_keyword, page_size=10)

    # Debug: print raw response
    print(f"\n[DEBUG] Raw search response:")
    print(json.dumps(search_result, ensure_ascii=False, indent=2))

    if not search_result.get('success'):
        print(f"\n✗ Search failed: {search_result}")
        return 1

    items = search_result.get('data', {}).get('items', [])
    cursor = search_result.get('data', {}).get('cursor')

    print(f"\n✓ Found {len(items)} notes")
    print(f"  Next cursor: {cursor}")

    if not items:
        print("✗ No search results")
        return 1

    # Display search results
    print(f"\n📝 Search Results:")
    note_ids = []
    user_ids = []

    for i, item in enumerate(items[:5], 1):
        note_card = item.get('note_card', {})
        note_id = item.get('id')
        title = note_card.get('display_title', 'No title')
        user = note_card.get('user', {})
        user_id = user.get('user_id')
        nickname = user.get('nickname')
        likes = note_card.get('interact_info', {}).get('liked_count', 0)

        print(f"\n  {i}. {title}")
        print(f"     Note ID: {note_id}")
        print(f"     Author: {nickname} (ID: {user_id})")
        print(f"     Likes: {likes}")

        if note_id:
            note_ids.append(note_id)
        if user_id:
            user_ids.append(user_id)

    # ═══════════════════════════════════════════════════════════
    # Step 2: Get Details for First Note
    # ═══════════════════════════════════════════════════════════
    if note_ids:
        first_note_id = note_ids[0]
        print_section(f"Step 2: Get Details for First Note")

        # Get note feed (detailed info)
        feed_result = client.xhs.get_feed(note_id=first_note_id)

        if feed_result.get('success'):
            feed_data = feed_result.get('data', {})
            print(f"✓ Note details retrieved")
            print(f"  Type: {feed_data.get('type', 'unknown')}")
            print(f"  Title: {feed_data.get('title', 'N/A')}")
            print(f"  Description: {feed_data.get('desc', 'N/A')[:100]}...")
        else:
            print(f"⚠ Could not get note details: {feed_result.get('msg', 'Unknown error')}")

        # Get note comments
        print(f"\n💬 Getting comments...")
        comments_result = client.xhs.get_note_comments(note_id=first_note_id)

        if comments_result.get('success'):
            comments = comments_result.get('data', {}).get('comments', [])
            print(f"✓ Found {len(comments)} comments")

            if comments:
                for i, comment in enumerate(comments[:3], 1):
                    user_info = comment.get('user_info', {})
                    print(f"\n  Comment {i}:")
                    print(f"    User: {user_info.get('nickname')}")
                    print(f"    Content: {comment.get('content', '')[:80]}...")
                    print(f"    Likes: {comment.get('like_count', 0)}")
        else:
            print(f"⚠ Could not get comments: {comments_result.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 3: Explore First Author
    # ═══════════════════════════════════════════════════════════
    if user_ids:
        first_user_id = user_ids[0]
        print_section(f"Step 3: Explore First Author")

        # Get user info
        user_info = client.xhs.get_user_info(user_id=first_user_id)

        if user_info.get('success'):
            user_data = user_info.get('data', {})
            basic_info = user_data.get('basic_info', {})
            interact_info = user_data.get('interact_info', {})

            print(f"✓ User Profile:")
            print(f"  Nickname: {basic_info.get('nickname')}")
            print(f"  Red ID: {basic_info.get('red_id')}")
            print(f"  Bio: {basic_info.get('desc', 'No bio')[:100]}")
            print(f"  Followers: {interact_info.get('follower_count', 0)}")
            print(f"  Notes: {interact_info.get('note_count', 0)}")
        else:
            print(f"⚠ Could not get user info: {user_info.get('msg', 'Unknown error')}")

        # Get user's other notes
        print(f"\n📚 Getting user's other notes...")
        user_notes = client.xhs.get_user_notes(user_id=first_user_id)

        if user_notes.get('success'):
            notes = user_notes.get('data', {}).get('notes', [])
            print(f"✓ Found {len(notes)} notes by this user")

            if notes:
                print(f"\n  Recent notes:")
                for i, note in enumerate(notes[:5], 1):
                    print(f"    {i}. {note.get('display_title', 'No title')}")
                    print(f"       Likes: {note.get('interact_info', {}).get('liked_count', 0)}")
        else:
            print(f"⚠ Could not get user notes: {user_notes.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 4: Find Related Topics
    # ═══════════════════════════════════════════════════════════
    print_section(f"Step 4: Find Related Topics")
    topics_result = client.xhs.search_topics(keyword=search_keyword)

    if topics_result.get('success'):
        topics = topics_result.get('data', {}).get('topics', [])
        print(f"✓ Found {len(topics)} related topics")

        if topics:
            print(f"\n🏷️  Top topics:")
            for i, topic in enumerate(topics[:5], 1):
                print(f"  {i}. #{topic.get('name')}")
                print(f"     Type: {topic.get('type')}")
                print(f"     Views: {topic.get('view_count', 0)}")
    else:
        print(f"⚠ Could not search topics: {topics_result.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 5: Pagination Example
    # ═══════════════════════════════════════════════════════════
    if cursor:
        print_section(f"Step 5: Load More Results (Pagination)")
        print(f"Using cursor: {cursor}")

        next_page = client.xhs.search(keyword=search_keyword, cursor=cursor, page_size=5)

        if next_page.get('success'):
            next_items = next_page.get('data', {}).get('items', [])
            print(f"✓ Loaded {len(next_items)} more results")

            if next_items:
                print(f"\n📝 Next page results:")
                for i, item in enumerate(next_items[:3], 1):
                    note_card = item.get('note_card', {})
                    print(f"  {i}. {note_card.get('display_title', 'No title')}")
        else:
            print(f"⚠ Could not load next page: {next_page.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════
    print_section("Search Flow Complete!")
    print(f"""
✓ Tested APIs:
  1. search(keyword, page_size) - Search notes
  2. search(keyword, cursor) - Pagination
  3. get_feed(note_id) - Get note details
  4. get_note_comments(note_id) - Read comments
  5. get_user_info(user_id) - Get author profile
  6. get_user_notes(user_id) - Browse author's content
  7. search_topics(keyword) - Find related topics

📊 Data Flow:
  Search → Extract IDs → Get details → Explore author → Find topics → Paginate
    """)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
