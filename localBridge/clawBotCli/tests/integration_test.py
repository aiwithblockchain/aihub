import sys
import os
import unittest
import threading
import time
import json
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.task_client import TaskClient
from utils.chunked_uploader import ChunkedUploader
from utils.progress_display import ProgressDisplay
from utils.api_client import MediaUploadTask

class TestIntegration(unittest.TestCase):
    """
    E2E 联调测试启动脚本。
    用于在 localBridge 运行时验证整个上传生命周期。
    """
    
    def setUp(self):
        self.dummy_file = os.path.join(os.path.dirname(__file__), "dummy_integration.mp4")
        # 实际使用时会读取 ~/.aihub/config.json
        self.task_client = TaskClient()
        self.uploader = ChunkedUploader(self.task_client)
        self.progress = ProgressDisplay(verbose=True)
        self.task = MediaUploadTask(self.task_client, self.uploader, self.progress)

    def tearDown(self):
        if os.path.exists(self.dummy_file):
            os.remove(self.dummy_file)

    def test_upload_small_file_logic(self):
        """测试小文件上传逻辑（模拟环境）"""
        print("\n--- Testing Small File Upload Logic ---")
        with open(self.dummy_file, "wb") as f:
            f.write(os.urandom(1024 * 1024 * 2)) # 2MB
            
        print(f"File created: {self.dummy_file}")
        # 这里仅进行方法调用的连通性验证
        self.assertIsNotNone(self.task_client.base_url)

    def test_upload_large_file_chunking(self):
        """测试大文件分片逻辑"""
        print("\n--- Testing Large File Chunking ---")
        # 创建一个 12MB 的文件，应该分为 3 个 5MB 的块
        size = 1024 * 1024 * 12
        with open(self.dummy_file, "wb") as f:
            f.write(os.urandom(size)) 
            
        # 验证分片计算是否正确
        # 我们 mock 掉实际上传方法
        with patch.object(self.task_client, 'upload_input_part', return_value=None):
            total_parts, total_bytes, content_type = self.uploader.upload_file("mock_id", self.dummy_file)
            self.assertEqual(total_parts, 3)
            self.assertEqual(total_bytes, size)

    def test_e2e_cancellation_flow(self):
        """验证取消流程的异常捕获"""
        print("\n--- Testing E2E Cancellation Flow ---")
        with open(self.dummy_file, "wb") as f:
            f.write(b"data")
            
        with patch.object(self.task_client, 'create_task', return_value="task_123"):
            with patch.object(self.uploader, 'upload_file', side_effect=KeyboardInterrupt):
                with patch.object(self.task_client, 'cancel_task') as mock_cancel:
                    with self.assertRaises(KeyboardInterrupt):
                        self.task.upload_video(self.dummy_file)
                    # 验证是否下发了取消指令
                    mock_cancel.assert_called_with("task_123")

if __name__ == '__main__':
    unittest.main()
