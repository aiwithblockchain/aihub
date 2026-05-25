#!/usr/bin/env python3
"""Integration tests for XHS (Xiaohongshu) API endpoints."""

import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def test_get_account_info():
    """Test getting XHS account information."""
    print("\n=== Test: Get Account Info ===")
    client = ClawBotClient()
    result = client.xhs.get_account_info()
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_homefeed():
    """Test getting XHS home feed without cursor."""
    print("\n=== Test: Get Homefeed ===")
    client = ClawBotClient()
    result = client.xhs.get_homefeed()
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_homefeed_with_cursor():
    """Test getting XHS home feed with pagination cursor."""
    print("\n=== Test: Get Homefeed with Cursor ===")
    client = ClawBotClient()
    result = client.xhs.get_homefeed(cursor_score="test_cursor")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_search():
    """Test searching XHS notes by keyword."""
    print("\n=== Test: Search ===")
    client = ClawBotClient()
    result = client.xhs.search(keyword="测试")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_search_with_pagination():
    """Test searching with pagination parameters."""
    print("\n=== Test: Search with Pagination ===")
    client = ClawBotClient()
    result = client.xhs.search(keyword="测试", cursor="test_cursor", page_size=10)
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_search_topics():
    """Test searching for XHS topics/hashtags."""
    print("\n=== Test: Search Topics ===")
    client = ClawBotClient()
    result = client.xhs.search_topics(keyword="测试")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_mentions_notifications():
    """Test getting mentions notifications."""
    print("\n=== Test: Get Mentions Notifications ===")
    client = ClawBotClient()
    result = client.xhs.get_notifications(notif_type="mentions")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_likes_notifications():
    """Test getting likes notifications."""
    print("\n=== Test: Get Likes Notifications ===")
    client = ClawBotClient()
    result = client.xhs.get_notifications(notif_type="likes")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_notifications_with_cursor():
    """Test getting notifications with pagination."""
    print("\n=== Test: Get Notifications with Cursor ===")
    client = ClawBotClient()
    result = client.xhs.get_notifications(notif_type="mentions", cursor="test_cursor")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_invalid_notification_type():
    """Test that invalid notification type raises ValueError."""
    print("\n=== Test: Invalid Notification Type ===")
    client = ClawBotClient()
    try:
        client.xhs.get_notifications(notif_type="invalid")
        print("✗ Should have raised ValueError")
    except ValueError as e:
        print(f"✓ Correctly raised ValueError: {e}")


def test_get_published_notes():
    """Test getting all notes published by current account."""
    print("\n=== Test: Get Published Notes ===")
    client = ClawBotClient()
    result = client.xhs.get_published_notes()
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_published_notes_with_cursor():
    """Test getting published notes with pagination."""
    print("\n=== Test: Get Published Notes with Cursor ===")
    client = ClawBotClient()
    result = client.xhs.get_published_notes(cursor="test_cursor")
    print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


# Tests that require valid IDs - commented out by default
def test_get_feed():
    """Test getting a specific note's feed data."""
    print("\n=== Test: Get Feed (SKIPPED - requires valid note_id) ===")
    # Uncomment and replace with valid note_id to test:
    # client = ClawBotClient()
    # note_id = "REPLACE_WITH_VALID_NOTE_ID"
    # result = client.xhs.get_feed(note_id=note_id)
    # print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_user_notes():
    """Test getting notes published by a specific user."""
    print("\n=== Test: Get User Notes (SKIPPED - requires valid user_id) ===")
    # Uncomment and replace with valid user_id to test:
    # client = ClawBotClient()
    # user_id = "REPLACE_WITH_VALID_USER_ID"
    # result = client.xhs.get_user_notes(user_id=user_id)
    # print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_user_info():
    """Test getting detailed user information."""
    print("\n=== Test: Get User Info (SKIPPED - requires valid user_id) ===")
    # Uncomment and replace with valid user_id to test:
    # client = ClawBotClient()
    # user_id = "REPLACE_WITH_VALID_USER_ID"
    # result = client.xhs.get_user_info(user_id=user_id)
    # print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_get_note_comments():
    """Test getting comments for a specific note."""
    print("\n=== Test: Get Note Comments (SKIPPED - requires valid note_id) ===")
    # Uncomment and replace with valid note_id to test:
    # client = ClawBotClient()
    # note_id = "REPLACE_WITH_VALID_NOTE_ID"
    # result = client.xhs.get_note_comments(note_id=note_id)
    # print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


def test_publish_note():
    """Test publishing a new image note."""
    print("\n=== Test: Publish Note (SKIPPED - requires valid image data and will create real content) ===")
    # Uncomment and replace with valid data to test:
    # client = ClawBotClient()
    # result = client.xhs.publish_note(
    #     title="测试标题",
    #     desc="测试内容",
    #     images=[{"data": "BASE64_ENCODED_IMAGE_DATA", "mime_type": "image/jpeg"}],
    #     privacy_type=0,
    #     topics=[]
    # )
    # print(f"✓ Result: {json.dumps(result, ensure_ascii=False, indent=2)}")


if __name__ == "__main__":
    print("=" * 60)
    print("XHS API Integration Tests")
    print("=" * 60)

    # Run tests that don't require specific IDs
    try:
        test_get_account_info()
        test_get_homefeed()
        test_get_homefeed_with_cursor()
        test_search()
        test_search_with_pagination()
        test_search_topics()
        test_get_mentions_notifications()
        test_get_likes_notifications()
        test_get_notifications_with_cursor()
        test_invalid_notification_type()
        test_get_published_notes()
        test_get_published_notes_with_cursor()

        # Show skipped tests
        test_get_feed()
        test_get_user_notes()
        test_get_user_info()
        test_get_note_comments()
        test_publish_note()

        print("\n" + "=" * 60)
        print("All tests completed!")
        print("=" * 60)
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
