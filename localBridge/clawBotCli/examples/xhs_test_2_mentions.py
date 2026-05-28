#!/usr/bin/env python3
"""Test XHS API 2: get_notifications (mentions) - prints raw response"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()
result = client.xhs.get_notifications(notif_type="mentions")
print(json.dumps(result, ensure_ascii=False, indent=2))
