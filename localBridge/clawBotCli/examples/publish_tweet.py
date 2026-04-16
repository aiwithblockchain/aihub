"""Example: publish a tweet."""

from clawbot import ClawBotClient

client = ClawBotClient()
result = client.x.actions.create_tweet("Hello from clawbot library")
print(result)
