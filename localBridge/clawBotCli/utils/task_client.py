import os
import json
import time
import logging
import requests
from typing import Optional, Callable

class TaskClient:
    """任务客户端，封装所有任务 REST API 调用"""
    
    def __init__(self, base_url: str = None, config_path: str = None):
        self.config = self._load_config(config_path)
        # 优先级：参数 > 配置文件 > 默认值
        self.base_url = base_url or self.config.get('base_url', 'http://localhost:8080')
        self.session = requests.Session()
    
    def _load_config(self, config_path: str = None) -> dict:
        """加载配置文件"""
        if config_path is None:
            config_path = os.path.expanduser("~/.aihub/config.json")
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def get_default_instance_id(self, client_name: str) -> str:
        """
        获取默认 instanceId
        优先级：配置文件 > 动态查询第一个在线实例
        """
        # 1. 尝试从配置文件读取
        instances = self.config.get('instances', {})
        instance_id = instances.get(client_name)
        if instance_id:
            return instance_id

        # 2. 动态查询在线实例，选择第一个
        try:
            url = f"{self.base_url}/api/v1/plugins"
            response = self.session.get(url, timeout=5)
            response.raise_for_status()
            plugins = response.json()

            # 过滤出匹配的 clientName
            matching_plugins = [p for p in plugins if p.get('clientName') == client_name]

            if matching_plugins:
                instance_id = matching_plugins[0]['instanceId']
                print(f"🔍 自动选择实例: {instance_id} ({matching_plugins[0].get('instanceName', 'Unknown')})")
                return instance_id

            raise ValueError(
                f"No online instance found for {client_name}. "
                f"Please ensure the browser extension is connected."
            )
        except Exception as e:
            raise ValueError(
                f"Failed to get instanceId for {client_name}: {e}\n"
                f"You can manually set it in ~/.aihub/config.json"
            )
    
    def create_task(
        self,
        client_name: str,
        instance_id: str,
        task_kind: str,
        input_mode: str,
        params: dict
    ) -> str:
        """
        创建长任务
        
        Args:
            client_name: 提交任务客户端标识 (例：tweetClaw)
            instance_id: 服务器设备 ID
            task_kind: 任务类型标识 (例：x.media_upload)
            input_mode: 流水结构标识 (例：chunked_binary)
            params: 业务承载元参数字典
            
        Returns:
            str: 创建成功的 taskId
        """
        url = f"{self.base_url}/api/v1/tasks"
        payload = {
            "clientName": client_name,
            "instanceId": instance_id,
            "taskKind": task_kind,
            "inputMode": input_mode,
            "params": params
        }
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        return response.json()['taskId']
    
    def upload_input_part(self, task_id: str, part_index: int, data: bytes) -> None:
        """
        向远程服务器分发数据切片
        
        Args:
            task_id: 正在运行的 Task ID
            part_index: 第几个编号的数据块
            data: 数据流的原始字节序列
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}/input/{part_index}"
        headers = {'Content-Type': 'application/octet-stream'}
        response = self.session.put(url, data=data, headers=headers)
        response.raise_for_status()
    
    def seal_input(self, task_id: str, total_parts: int, total_bytes: int, content_type: str) -> None:
        """
        封存输入信号，告知服务端分片结束
        
        Args:
            task_id: 正在运行的 Task ID
            total_parts: 提交的分片总数
            total_bytes: 用于远端完整性验证的字节总数
            content_type: 文件原本或猜测出来的 MIME Type
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}/seal"
        payload = {
            "totalParts": total_parts,
            "totalBytes": total_bytes,
            "contentType": content_type
        }
        response = self.session.post(url, json=payload)
        response.raise_for_status()
    
    def start_task(self, task_id: str) -> None:
        """
        命令底层扩展立刻启动被封存队列里的任务
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}/start"
        response = self.session.post(url)
        response.raise_for_status()
    
    def get_task_status(self, task_id: str) -> dict:
        """
        获取当前长任务的运行生命周期状态和进度比例
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def get_task_result(self, task_id: str) -> bytes:
        """
        索取运行成功的任务返回最终载体（例如 JSON 返回值）
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}/result"
        response = self.session.get(url)
        response.raise_for_status()
        return response.content
    
    def cancel_task(self, task_id: str) -> None:
        """
        触发信号通知服务端与底层销毁运行中的长任务
        """
        url = f"{self.base_url}/api/v1/tasks/{task_id}/cancel"
        response = self.session.post(url)
        response.raise_for_status()
    
    def wait_for_completion(
        self,
        task_id: str,
        poll_interval: float = 2.0,
        timeout: float = 300.0,
        progress_callback: Optional[Callable] = None
    ) -> dict:
        """
        阻塞等待并轮询获取长任务的终端状态
        支持超时截断防死锁，支持 Ctrl+C 打断并连带下发服务端 cancel 命令
        
        Args:
            task_id: 正在运行的 Task ID
            poll_interval: 轮询查询 /api/v1/tasks 的心跳间隔秒数
            timeout: 最大可容忍阻塞超时时长
            progress_callback: 回调指针，传入 (state, phase, progress) 用于 UI 渲染
            
        Returns:
            dict: 最终成功、失败或取消的完整服务器任务状态字典
        """
        start_time = time.time()
        last_progress = -1
        
        try:
            while True:
                if time.time() - start_time > timeout:
                    try:
                        self.cancel_task(task_id)
                        logging.info(f"Task {task_id} cancelled due to timeout")
                    except Exception as e:
                        logging.warning(f"Failed to cancel task on timeout: {e}")
                    raise TimeoutError(f"Task {task_id} timeout after {timeout}s")
                
                status = self.get_task_status(task_id)
                state = status['state']
                
                if state in ['completed', 'failed', 'cancelled']:
                    return status
                
                if progress_callback and status.get('progress', 0) != last_progress:
                    progress_callback(state, status.get('phase', ''), status.get('progress', 0))
                    last_progress = status.get('progress', 0)
                
                time.sleep(poll_interval)
        except KeyboardInterrupt:
            try:
                self.cancel_task(task_id)
                logging.info(f"Task {task_id} cancelled by user")
            except Exception as e:
                logging.warning(f"Failed to cancel task: {e}")
            raise
