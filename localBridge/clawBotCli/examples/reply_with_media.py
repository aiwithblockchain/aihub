"""Example: reply with uploaded media."""

from clawbot import ClawBotClient

client = ClawBotClient()
result = client.media.reply_with_media("TWEET_ID", "Reply with media", ["./test_media/app_1.png"])
print(result)
