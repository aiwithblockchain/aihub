#!/usr/bin/env python3
"""Test get_published_notes API."""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient


def main():
    client = ClawBotClient()

    print("Testing get_published_notes()...")
    result = client.xhs.get_published_notes(page=0)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
