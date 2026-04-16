#!/usr/bin/env python3
"""Example focused on publishing and replying with optional media."""

import argparse
from typing import List

from clawbot import ClawBotClient


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish or reply via clawbot library")
    parser.add_argument("--text", required=True, help="Tweet or reply text")
    parser.add_argument("--reply-to", help="Reply target tweet id")
    parser.add_argument("--media", help="Comma-separated media paths")
    args = parser.parse_args()

    client = ClawBotClient()
    media_paths: List[str] = [item.strip() for item in args.media.split(",")] if args.media else []

    if args.reply_to:
        if media_paths:
            result = client.media.reply_with_media(args.reply_to, args.text, media_paths)
        else:
            result = client.x.actions.reply(args.reply_to, args.text)
    else:
        if media_paths:
            result = client.media.post_tweet(args.text, media_paths)
        else:
            result = client.x.actions.create_tweet(args.text)

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
