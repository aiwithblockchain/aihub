#!/usr/bin/env python3
"""
XHS Notifications and My Content Example

Scenario: Check notifications and manage my published content
- Get mentions and likes notifications
- View my published notes
- Explore engagement on my content
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
    # Step 1: Get Account Info
    # ═══════════════════════════════════════════════════════════
    print_section("Step 1: Get My Account Info")
    account = client.xhs.get_account_info()

    if not account.get('success'):
        print(f"✗ Failed to get account info: {account}")
        return 1

    data = account.get('data', {})
    my_nickname = data.get('nickname')
    my_user_id = data.get('user_id')

    print(f"✓ Logged in as: {my_nickname}")
    print(f"  User ID: {my_user_id}")
    print(f"  Red ID: {data.get('red_id')}")

    # ═══════════════════════════════════════════════════════════
    # Step 2: Check Mentions Notifications
    # ═══════════════════════════════════════════════════════════
    print_section("Step 2: Check Mentions (@)")
    mentions = client.xhs.get_notifications(notif_type="mentions")

    if mentions.get('success'):
        mention_data = mentions.get('data', {})
        mention_list = mention_data.get('messages', [])
        has_more = mention_data.get('has_more', False)
        cursor = mention_data.get('cursor')

        print(f"✓ Found {len(mention_list)} mention notifications")
        print(f"  Has more: {has_more}")
        print(f"  Cursor: {cursor}")

        if mention_list:
            print(f"\n💬 Recent mentions:")
            for i, mention in enumerate(mention_list[:5], 1):
                user = mention.get('user', {})
                print(f"\n  {i}. {user.get('nickname')} mentioned you")
                print(f"     User ID: {user.get('user_id')}")
                print(f"     Time: {mention.get('time')}")
                print(f"     Content: {mention.get('content', '')[:80]}...")
    else:
        print(f"⚠ Could not get mentions: {mentions.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 3: Check Likes Notifications
    # ═══════════════════════════════════════════════════════════
    print_section("Step 3: Check Likes (❤️)")
    likes = client.xhs.get_notifications(notif_type="likes")

    if likes.get('success'):
        like_data = likes.get('data', {})
        like_list = like_data.get('messages', [])
        has_more = like_data.get('has_more', False)

        print(f"✓ Found {len(like_list)} like notifications")
        print(f"  Has more: {has_more}")

        if like_list:
            print(f"\n❤️  Recent likes:")
            for i, like in enumerate(like_list[:5], 1):
                user = like.get('user', {})
                print(f"\n  {i}. {user.get('nickname')} liked your content")
                print(f"     User ID: {user.get('user_id')}")
                print(f"     Time: {like.get('time')}")
    else:
        print(f"⚠ Could not get likes: {likes.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Step 4: Get My Published Notes
    # ═══════════════════════════════════════════════════════════
    print_section("Step 4: Get My Published Notes")
    my_notes = client.xhs.get_published_notes()

    if my_notes.get('success'):
        notes_data = my_notes.get('data', {})
        notes_list = notes_data.get('notes', [])
        has_more = notes_data.get('has_more', False)
        cursor = notes_data.get('cursor')

        print(f"✓ Found {len(notes_list)} published notes")
        print(f"  Has more: {has_more}")
        print(f"  Cursor: {cursor}")

        if notes_list:
            print(f"\n📝 My recent notes:")
            note_ids = []

            for i, note in enumerate(notes_list[:5], 1):
                note_id = note.get('note_id')
                title = note.get('display_title', 'No title')
                interact_info = note.get('interact_info', {})
                likes = interact_info.get('liked_count', 0)
                comments = interact_info.get('comment_count', 0)

                print(f"\n  {i}. {title}")
                print(f"     Note ID: {note_id}")
                print(f"     Likes: {likes} | Comments: {comments}")

                if note_id:
                    note_ids.append(note_id)

            # ═══════════════════════════════════════════════════════════
            # Step 5: Check Comments on My First Note
            # ═══════════════════════════════════════════════════════════
            if note_ids:
                first_note_id = note_ids[0]
                print_section(f"Step 5: Check Comments on My First Note")

                comments = client.xhs.get_note_comments(note_id=first_note_id)

                if comments.get('success'):
                    comment_data = comments.get('data', {})
                    comment_list = comment_data.get('comments', [])

                    print(f"✓ Found {len(comment_list)} comments")

                    if comment_list:
                        print(f"\n💬 Recent comments:")
                        for i, comment in enumerate(comment_list[:5], 1):
                            user_info = comment.get('user_info', {})
                            print(f"\n  {i}. {user_info.get('nickname')}")
                            print(f"     Content: {comment.get('content', '')[:80]}...")
                            print(f"     Likes: {comment.get('like_count', 0)}")
                            print(f"     Time: {comment.get('create_time')}")
                else:
                    print(f"⚠ Could not get comments: {comments.get('msg', 'Unknown error')}")

            # ═══════════════════════════════════════════════════════════
            # Step 6: Pagination - Load More Notes
            # ═══════════════════════════════════════════════════════════
            if has_more and cursor:
                print_section(f"Step 6: Load More Published Notes")
                print(f"Using cursor: {cursor}")

                more_notes = client.xhs.get_published_notes(cursor=str(cursor))

                if more_notes.get('success'):
                    more_list = more_notes.get('data', {}).get('notes', [])
                    print(f"✓ Loaded {len(more_list)} more notes")

                    if more_list:
                        print(f"\n📝 Next page:")
                        for i, note in enumerate(more_list[:3], 1):
                            print(f"  {i}. {note.get('display_title', 'No title')}")
                else:
                    print(f"⚠ Could not load more notes: {more_notes.get('msg', 'Unknown error')}")
    else:
        print(f"⚠ Could not get published notes: {my_notes.get('msg', 'Unknown error')}")

    # ═══════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════
    print_section("Notifications & Content Flow Complete!")
    print(f"""
✓ Tested APIs:
  1. get_account_info() - Get my profile
  2. get_notifications(notif_type='mentions') - Check @ mentions
  3. get_notifications(notif_type='likes') - Check likes
  4. get_published_notes() - View my content
  5. get_published_notes(cursor) - Pagination
  6. get_note_comments(note_id) - Check engagement

📊 Data Flow:
  Account → Mentions → Likes → My Notes → Comments → Paginate
    """)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
