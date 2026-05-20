"""Example: reply to a pinned tweet with AI-generated text."""

from clawbot import ClawBotClient

client = ClawBotClient()
result = client.workflows.reply_to_pinned_tweet_with_ai("openclaw", "chatgpt")
print(result)
