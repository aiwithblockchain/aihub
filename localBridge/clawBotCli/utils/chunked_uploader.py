import os
import math
import time
import mimetypes
import requests
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from typing import Optional, Callable, Tuple

class ChunkedUploader:
    """
    分片上传器（受控窗口模型）
    
    并发模型约束：
    - max_workers 表示同时在飞的上传请求数上限
    - 任何时刻最多 max_workers 个分片在上传中
    - 只有上传成功确认后才读取下一个分片
    - 文件读取不会领先于在飞窗口上限
    """
    
    def __init__(
        self,
        task_client,
        chunk_size: int = 5 * 1024 * 1024,  # 5MB
        max_workers: int = 4,  # 在飞上传请求数上限
        retry_count: int = 3
    ):
        """
        初始化分片上传器
        
        Args:
            task_client: TaskClient 实例
            chunk_size: 每个分片的大小 (字节)
            max_workers: 最大并发上传数
            retry_count: 每个分片上传失败后的重试次数
        """
        self.task_client = task_client
        self.chunk_size = chunk_size
        self.max_workers = max_workers
        self.retry_count = retry_count
    
    def _detect_content_type(self, file_path: str) -> str:
        """
        检测文件的 MIME 类型
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: MIME 类型字符串
        """
        content_type, _ = mimetypes.guess_type(file_path)
        return content_type or 'application/octet-stream'
    
    def upload_file(
        self,
        task_id: str,
        file_path: str,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[int, int, str]:
        """
        上传文件（受控窗口模型）
        
        Args:
            task_id: 关联的任务 ID
            file_path: 待上传的文件路径
            progress_callback: 进度回调函数，参数为 (已完成分片数, 总分片数)
            
        Returns:
            Tuple[int, int, str]: (分片总数, 文件大小, MIME 类型)
        """
        file_size = os.path.getsize(file_path)
        total_parts = math.ceil(file_size / self.chunk_size)
        total_parts = max(1, total_parts) # ensure at least 1 part
        content_type = self._detect_content_type(file_path)
        
        with open(file_path, 'rb') as f:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {}  # {future: part_index}
                part_index = 0
                uploaded_count = 0
                
                # 初始填充窗口
                while part_index < total_parts and len(futures) < self.max_workers:
                    chunk = f.read(self.chunk_size)
                    if not chunk and part_index > 0:
                        break
                    future = executor.submit(
                        self._upload_chunk,
                        task_id,
                        part_index,
                        chunk,
                        self.retry_count
                    )
                    futures[future] = part_index
                    part_index += 1
                
                # 滚动窗口：一个完成，读取下一个
                while futures:
                    # 等待任一 future 完成
                    done, _ = wait(futures.keys(), return_when=FIRST_COMPLETED)
                    
                    for future in done:
                        try:
                            future.result()  # 检查是否有异常
                            uploaded_count += 1
                            if progress_callback:
                                progress_callback(uploaded_count, total_parts)
                        except Exception as e:
                            # 快速失败：取消所有未完成的上传
                            for f_item in futures.keys():
                                f_item.cancel()
                            raise Exception(f"Upload failed at part {futures[future]}: {e}")
                        finally:
                            del futures[future]
                    
                    # 补充窗口：读取下一个分片
                    while part_index < total_parts and len(futures) < self.max_workers:
                        chunk = f.read(self.chunk_size)
                        if not chunk:
                            break
                        future = executor.submit(
                            self._upload_chunk,
                            task_id,
                            part_index,
                            chunk,
                            self.retry_count
                        )
                        futures[future] = part_index
                        part_index += 1
        
        return total_parts, file_size, content_type
    
    def _upload_chunk(
        self,
        task_id: str,
        part_index: int,
        data: bytes,
        retry_count: int
    ) -> None:
        """
        执行单个数据分片的上传逻辑
        包含基于指数退避算法的重试机制，最大退避间隔为 5 秒。
        
        Args:
            task_id: 关联的任务 ID
            part_index: 正在上传的分片序号
            data: 该分片的原始字节数据
            retry_count: 允许的最大重试次数
        """
        for attempt in range(retry_count):
            try:
                self.task_client.upload_input_part(task_id, part_index, data)
                return
            except requests.exceptions.RequestException as e:
                if attempt == retry_count - 1:
                    raise
                wait_time = min(2 ** attempt, 5)
                time.sleep(wait_time)
