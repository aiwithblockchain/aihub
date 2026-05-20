"""Demo script migrated from original openclaw workflow direction."""

from clawbot import ClawBotClient

client = ClawBotClient()
status = client.x.status.get_status()
print(status)
