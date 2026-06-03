#!/usr/bin/env python3
"""Test XHS API 1: get_homefeed
Usage:
  python3 examples/xhs_test_1_homefeed.py                          # 默认推荐流
  python3 examples/xhs_test_1_homefeed.py --category homefeed_follow  # 关注流
  python3 examples/xhs_test_1_homefeed.py --num 30                   # 指定数量
  python3 examples/xhs_test_1_homefeed.py --help                     # 查看所有参数
"""

import sys, os, json, argparse
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

def main():
    parser = argparse.ArgumentParser(description='Test XHS homefeed API')
    parser.add_argument('--cursor-score', type=str, default=None, help='Pagination cursor')
    parser.add_argument('--category', type=str, default=None,
                        help='Feed category (e.g., homefeed_recommend, homefeed_follow)')
    parser.add_argument('--refresh-type', type=int, default=None, help='Refresh type (1=first page, 3=pagination)')
    parser.add_argument('--num', type=int, default=None, help='Number of items per page')
    parser.add_argument('--note-index', type=int, default=None, help='Note index offset')
    parser.add_argument('--need-num', type=int, default=None, help='Number of items needed')
    parser.add_argument('--search-key', type=str, default=None, help='Search key')
    parser.add_argument('--show-all', action='store_true', help='Show all items instead of first 3')

    args = parser.parse_args()

    client = ClawBotClient()

    print("=" * 60)
    print("Test: Get homefeed")
    print("=" * 60)

    # 显示请求参数
    params = {}
    if args.cursor_score: params['cursor_score'] = args.cursor_score
    if args.category: params['category'] = args.category
    if args.refresh_type is not None: params['refresh_type'] = args.refresh_type
    if args.num is not None: params['num'] = args.num
    if args.note_index is not None: params['note_index'] = args.note_index
    if args.need_num is not None: params['need_num'] = args.need_num
    if args.search_key: params['search_key'] = args.search_key

    if params:
        print("\nRequest parameters:")
        for k, v in params.items():
            print(f"  {k}: {v}")
    else:
        print("\nUsing default parameters")

    result = client.xhs.get_homefeed(
        cursor_score=args.cursor_score,
        category=args.category,
        refresh_type=args.refresh_type,
        num=args.num,
        note_index=args.note_index,
        need_num=args.need_num,
        search_key=args.search_key,
    )

    print(f"\nSuccess: {result.get('success')}")

    if result.get('success'):
        data = result.get('data', {})
        cursor_score = data.get('cursor_score', '')
        items = data.get('items', [])

        print(f"Cursor score: {cursor_score}")
        print(f"Items count: {len(items)}")

        if items:
            display_count = len(items) if args.show_all else min(3, len(items))
            print(f"\nShowing {display_count} of {len(items)} notes:")

            for i, item in enumerate(items[:display_count], 1):
                note_id = item.get('id', 'N/A')
                xsec_token = item.get('xsec_token', 'N/A')
                note_card = item.get('note_card', {})
                title = note_card.get('display_title', 'No title')
                user = note_card.get('user', {})
                nickname = user.get('nickname', 'Unknown')

                print(f"\n  {i}. {title[:50]}...")
                print(f"     ID: {note_id}")
                print(f"     Token: {xsec_token[:30]}...")
                print(f"     Author: {nickname}")

        # 如果有下一页，提示如何获取
        if cursor_score:
            print("\n" + "=" * 60)
            print("To get next page, run:")
            print(f"  python3 examples/xhs_test_1_homefeed.py --cursor-score '{cursor_score}'")
            print("=" * 60)
    else:
        print(f"\nError: {result.get('error', 'Unknown error')}")
        print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")

if __name__ == '__main__':
    main()
