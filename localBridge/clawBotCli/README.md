# ClawBot - Python Library for X/Twitter Automation

A Python library for automating X/Twitter interactions through LocalBridge and TweetCat.

## Quick Start

```bash
pip install -r requirements.txt
```

```python
from clawbot import ClawBotClient

client = ClawBotClient()

# Check status
status = client.x.status.get_status()
print(f"Logged in: {status.is_logged_in}")

# Read timeline
tweets = client.x.timeline.list_timeline_tweets()
for tweet in tweets[:5]:
    print(f"{tweet.id}: {tweet.text}")

# Post a tweet
result = client.x.actions.create_tweet("Hello from ClawBot! 🤖")
print(f"Tweet created: {result.success}")
```

## Core Features

### X/Twitter Operations

```python
# Status & Info
status = client.x.status.get_status()
user = client.x.users.get_user("elonmusk")

# Read Operations
tweets = client.x.timeline.list_timeline_tweets()
tweet = client.x.tweets.get_tweet(tweet_id)  # raw REST endpoint: GET /api/v1/x/tweets?tweetId=...
tweets, users = client.x.search.search("AI", count=20)

# Write Operations
result = client.x.actions.create_tweet("Hello World")
result = client.x.actions.reply(tweet_id, "Nice tweet!")
result = client.x.actions.like(tweet_id)
result = client.x.actions.retweet(tweet_id)
result = client.x.actions.bookmark(tweet_id)
result = client.x.actions.follow(user_id)

# Tab Control
tab = client.x.tabs.open("home")
result = client.x.tabs.navigate("notifications", tab.tab_id)
result = client.x.tabs.close(tab.tab_id)
```

### Media Upload

```python
# Upload and post
result = client.media.post_tweet(
    text="Check out this image!",
    file_paths=["image.jpg"]
)

# Upload and reply
result = client.media.reply_with_media(
    tweet_id="123456789",
    text="Here's my response",
    file_paths=["image1.jpg", "image2.jpg"]
)
```

### AI Integration

```python
# Send message to AI
result = client.ai.chat.send_message("chatgpt", "Hello AI!")
print(result.content)

# Navigate to AI platform
result = client.ai.navigation.navigate("chatgpt")
```

## Project Structure

```
clawbot/              # Core library
├── client.py         # Main entry point
├── services/         # Service layer (x, ai, media)
├── domain/           # Data models and parsers
├── transport/        # HTTP API layer
├── workflows/        # High-level workflows
└── upload/           # Media upload system

examples/             # Usage examples
tests/                # Test suite
```

## Requirements

- Python 3.10+
- LocalBridge running (http://127.0.0.1:10088)
- TweetCat browser extension installed and connected
- X/Twitter account logged in

## Configuration

Default configuration in `clawbot/config.py`:

```python
API_BASE_URL = "http://127.0.0.1:10088"
API_TIMEOUT = 30  # seconds
```

## Copy to Another Project

To use this library in another project, copy the `clawbot/` directory:

```
your_project/
├── app/
├── clawbot/          # Copy this directory
└── main.py
```

Then import and use:

```python
from clawbot import ClawBotClient
client = ClawBotClient()
```

See [最小复制包说明.md](最小复制包说明.md) for details.

## Examples

See the `examples/` directory for complete examples:
- `read_timeline.py` - Read and display timeline
- `publish_tweet.py` - Post tweets with media
- `reply_with_media.py` - Reply with images
- `ai_reply_pinned_tweet.py` - AI-powered replies

## Error Handling

```python
from clawbot.errors import (
    MediaUploadError,
    ParseError,
    TaskTimeoutError,
    ApiRequestError
)

try:
    client.media.post_tweet("Hello", ["image.jpg"])
except TaskTimeoutError:
    # Retry - task execution timeout
    pass
except MediaUploadError:
    # Upload failed
    pass
except ApiRequestError:
    # API request failed
    pass
```

## Related Projects

- **LocalBridge**: Bridge local AI agents with X/Twitter APIs
- **TweetCat**: Browser extension for X automation

---

*For detailed architecture and migration docs, see [重构实施清单.md](重构实施清单.md)*
