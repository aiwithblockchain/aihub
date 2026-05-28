#!/usr/bin/env python3
"""Test XHS API 4: get_published_notes - prints raw response"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()
result = client.xhs.get_published_notes()
print(json.dumps(result, ensure_ascii=False, indent=2))
