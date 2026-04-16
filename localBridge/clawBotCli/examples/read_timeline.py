"""Example: read and print timeline tweets."""

from clawbot import ClawBotClient

client = ClawBotClient()
for tweet in client.x.timeline.list_timeline_tweets()[:5]:
    print(f"- {tweet.author_screen_name}: {tweet.text}")
