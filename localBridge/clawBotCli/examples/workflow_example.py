#!/usr/bin/env python3
"""Example migrated from legacy workflow test."""

from clawbot import ClawBotClient


def main() -> int:
    client = ClawBotClient()

    print("\n🧪 Workflow example via clawbot")
    print("=" * 60)

    status = client.x.status.get_status()
    if not status.is_logged_in:
        print("❌ Not logged in to X.com")
        return 1
    print(f"✅ Logged in with {len(status.tabs)} open tab(s)")

    first = client.x.timeline.get_first_timeline_tweet()
    if not first or not first.id:
        print("❌ No tweet found in timeline")
        return 1
    print(f"✅ Found first timeline tweet: {first.id}")

    like_result = client.x.actions.like(first.id)
    print(f"Like result: {like_result}")

    unlike_result = client.x.actions.unlike(first.id)
    print(f"Unlike result: {unlike_result}")

    user = client.x.search.search_first_user("AI")
    if user and user.screen_name:
        profile = client.x.users.get(user.screen_name)
        print(f"Profile result: @{profile.screen_name} / {profile.name}")

    tab = client.x.tabs.open("home")
    print(f"Opened tab: {tab.tab_id}")
    if tab.tab_id is not None:
        print(client.x.tabs.navigate("notifications", tab.tab_id))
        print(client.x.tabs.close(tab.tab_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
