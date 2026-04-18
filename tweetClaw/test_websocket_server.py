#!/usr/bin/env python3
"""
Mock WebSocket server for testing TweetClaw extension.
Simulates LocalBridge protocol and automatically sends supported test commands:
- command.query_xhs_account_info
- command.query_x_basic_info
"""
import asyncio
import json
import websockets
from datetime import datetime

class MockLocalBridge:
    def __init__(self, host='127.0.0.1', port=10086, log_file='2.log'):
        self.host = host
        self.port = port
        self.clients = set()
        self.log_file = log_file

    def log(self, message):
        """Write to both console and log file"""
        print(message)
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(message + '\n')

    async def handle_client(self, websocket):
        self.clients.add(websocket)
        msg = f"[{datetime.now()}] Client connected from {websocket.remote_address}"
        self.log(msg)

        try:
            async for message in websocket:
                data = json.loads(message)
                formatted = f"\n[RECV] {json.dumps(data, indent=2, ensure_ascii=False)}"
                self.log(formatted)

                # Handle client.hello
                if data.get('type') == 'client.hello':
                    response = {
                        'type': 'server.hello_ack',
                        'id': data.get('id'),
                        'source': 'MockLocalBridge',
                        'target': 'tweetClaw',
                        'timestamp': int(datetime.now().timestamp() * 1000),
                        'payload': {
                            'protocolName': 'aihub-localbridge',
                            'protocolVersion': 'v1',
                            'serverName': 'MockLocalBridge',
                            'serverVersion': '0.1.0-test',
                            'heartbeatIntervalMs': 20000
                        }
                    }
                    await websocket.send(json.dumps(response))
                    self.log(f"[SEND] {json.dumps(response, indent=2)}")

                # Handle ping
                elif data.get('type') == 'ping':
                    response = {
                        'type': 'pong',
                        'id': data.get('id')
                    }
                    await websocket.send(json.dumps(response))
                    self.log(f"[SEND] pong for {data.get('id')}")

                # Echo other messages
                else:
                    self.log(f"[INFO] Received message type: {data.get('type')}")

        except websockets.exceptions.ConnectionClosed:
            msg = f"[{datetime.now()}] Client disconnected"
            self.log(msg)
        finally:
            self.clients.remove(websocket)

    async def send_test_command(self):
        """Wait for client connection (up to 2 minutes) then send supported test commands"""
        max_wait = 120  # 2 minutes
        wait_interval = 2  # Check every 2 seconds
        elapsed = 0

        self.log("[INFO] Waiting for client connection (max 2 minutes)...")
        self.log("[INFO] Supported auto-test commands: command.query_xhs_account_info, command.query_x_basic_info")

        while elapsed < max_wait:
            if self.clients:
                self.log(f"[INFO] Client connected after {elapsed} seconds, sending test commands in 5 seconds...")
                await asyncio.sleep(5)
                break
            await asyncio.sleep(wait_interval)
            elapsed += wait_interval

        if not self.clients:
            self.log("[WARN] No clients connected after 2 minutes, test commands not sent")
            return

        # Test 1: Query current Xiaohongshu account info
        test_command_1 = {
            'type': 'command.query_xhs_account_info',
            'id': 'test-xhs-account-001',
            'source': 'MockLocalBridge',
            'target': 'tweetClaw',
            'timestamp': int(datetime.now().timestamp() * 1000),
            'payload': {}
        }

        for client in self.clients:
            await client.send(json.dumps(test_command_1))
            self.log(f"\n[SEND TEST] Query current Xiaohongshu account info:\n{json.dumps(test_command_1, indent=2)}")

        # Wait a bit before sending next command
        await asyncio.sleep(3)

        # Test 2: Query current X basic info
        test_command_2 = {
            'type': 'command.query_x_basic_info',
            'id': 'test-x-basic-002',
            'source': 'MockLocalBridge',
            'target': 'tweetClaw',
            'timestamp': int(datetime.now().timestamp() * 1000),
            'payload': {}
        }

        for client in self.clients:
            await client.send(json.dumps(test_command_2))
            self.log(f"\n[SEND TEST] Query current X basic info:\n{json.dumps(test_command_2, indent=2)}")

    async def start(self):
        msg = f"Starting mock LocalBridge server on ws://{self.host}:{self.port}"
        self.log(msg)
        self.log(f"Logging to: {self.log_file}\n")

        async with websockets.serve(self.handle_client, self.host, self.port):
            # Send supported test commands automatically
            asyncio.create_task(self.send_test_command())
            await asyncio.Future()  # Run forever

if __name__ == '__main__':
    server = MockLocalBridge()
    asyncio.run(server.start())
