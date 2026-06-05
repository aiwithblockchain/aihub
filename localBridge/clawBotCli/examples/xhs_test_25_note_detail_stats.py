#!/usr/bin/env python3
"""Test XHS API 25: get_note_detail_stats (笔记数据统计 - 7天/30天)
Usage:
  python3 examples/xhs_test_25_note_detail_stats.py <note_id>
  python3 examples/xhs_test_25_note_detail_stats.py              # auto-pick from published_notes
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

if len(sys.argv) >= 2:
    note_id = sys.argv[1]
    print(f"Using provided note_id={note_id}")
else:
    print("Step 1: get_published_notes to pick note_id...")
    notes_resp = client.xhs.get_published_notes()
    if not notes_resp.get("success"):
        print(f"✗ get_published_notes failed: {notes_resp}")
        sys.exit(1)

    notes = notes_resp.get("data", {}).get("notes", [])
    if not notes:
        print("✗ No published notes found")
        sys.exit(1)

    note_id = notes[0].get("note_id")
    if not note_id:
        print("✗ No note_id found in first note")
        sys.exit(1)
    print(f"  Auto-picked note_id: {note_id}")
    print(f"  Title: {notes[0].get('title', 'N/A')}")

print("\n" + "=" * 60)
print("Test: get_note_detail_stats (笔记数据统计)")
print("=" * 60)

result = client.xhs.get_note_detail_stats(note_id=note_id)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})

    # 7天数据
    seven = data.get("seven", {})
    print("\n--- 7天数据 ---")
    print(f"浏览量      : {seven.get('view_count', 'N/A')}")
    print(f"平均观看时长: {seven.get('view_time_avg', 'N/A')} 秒")
    print(f"首页曝光数  : {seven.get('home_view_count', 'N/A')}")
    print(f"点赞数      : {seven.get('like_count', 'N/A')}")
    print(f"收藏数      : {seven.get('collect_count', 'N/A')}")
    print(f"评论数      : {seven.get('comment_count', 'N/A')}")
    print(f"分享数      : {seven.get('share_count', 'N/A')}")
    print(f"涨粉数      : {seven.get('rise_fans_count', 'N/A')}")

    # 增长率
    print("\n--- 7天增长率 (相比上一周期) ---")
    print(f"浏览量增长  : {seven.get('view_count_rate', 'N/A')}")
    print(f"点赞增长    : {seven.get('like_count_rate', 'N/A')}")
    print(f"收藏增长    : {seven.get('collect_count_rate', 'N/A')}")

    # 每日趋势 (显示最近3天)
    view_list = seven.get("view_list", [])
    if view_list:
        print(f"\n--- 7天浏览量趋势 (最近3天) ---")
        for item in view_list[-3:]:
            import time
            date_str = time.strftime('%Y-%m-%d', time.localtime(item.get('date', 0) / 1000))
            print(f"  {date_str}: {item.get('count', 0)}")

    # AI 摘要
    summary = seven.get("summary", "")
    if summary:
        print(f"\n--- AI 分析摘要 ---")
        print(summary[:200] + "..." if len(summary) > 200 else summary)

    # 30天数据
    thirty = data.get("thirty", {})
    print("\n--- 30天数据 ---")
    print(f"浏览量      : {thirty.get('view_count', 'N/A')}")
    print(f"平均观看时长: {thirty.get('view_time_avg', 'N/A')} 秒")
    print(f"首页曝光数  : {thirty.get('home_view_count', 'N/A')}")
    print(f"点赞数      : {thirty.get('like_count', 'N/A')}")
    print(f"收藏数      : {thirty.get('collect_count', 'N/A')}")
    print(f"评论数      : {thirty.get('comment_count', 'N/A')}")
    print(f"分享数      : {thirty.get('share_count', 'N/A')}")
    print(f"涨粉数      : {thirty.get('rise_fans_count', 'N/A')}")

    # 30天增长率
    print("\n--- 30天增长率 (相比上一周期) ---")
    print(f"浏览量增长  : {thirty.get('view_count_rate', 'N/A')}")
    print(f"点赞增长    : {thirty.get('like_count_rate', 'N/A')}")
    print(f"收藏增长    : {thirty.get('collect_count_rate', 'N/A')}")

    # 完整数据 (可选)
    if "--verbose" in sys.argv or "-v" in sys.argv:
        print("\n--- 完整响应数据 ---")
        print(json.dumps(data, ensure_ascii=False, indent=2))
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(f"Full response: {json.dumps(result, ensure_ascii=False, indent=2)}")