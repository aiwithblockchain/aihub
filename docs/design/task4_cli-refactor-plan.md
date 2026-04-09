# 阶段 4：CLI 任务式调用改造实施计划

## 文档信息
- 文档名称：阶段 4：CLI 任务式调用改造实施计划
- 版本：v1.3
- 状态：已通过评审，可作为开发依据
- 创建日期：2026-04-09
- 最后修订：2026-04-09（修订 P0-1、P0-2、I1、I2，清理残留旧内容）
- 依赖文档：
  - [4.长任务透传链路彻底重构方案.md](./4.长任务透传链路彻底重构方案.md)
  - [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md)
  - [task2_long-task-manager-plan.md](./task2_long-task-manager-plan.md)
  - [task3_tweetclaw-refactor-plan.md](./task3_tweetclaw-refactor-plan.md)

---

## 1. 计划概述

本阶段目标是将 Python CLI 改造为任务式调用模式，实现：

- 创建长任务并获取 taskId
- 分片上传大文件到 Go Task Data Store
- Seal 输入并启动任务
- 轮询任务状态获取进度
- 获取任务结果
- 支持任务取消

阶段 2 已完成 Go 侧的 REST API，阶段 3 已完成插件侧的任务执行器。阶段 4 在此基础上改造 CLI 调用方式，使其成为标准的任务客户端。

---

## 2. 本阶段目标

### 2.1 必须达成的结果

阶段 4 完成后，Python CLI 必须支持以下闭环：

1. 创建长任务（POST /api/v1/tasks）
2. 分片上传输入数据（PUT /api/v1/tasks/{taskId}/input/{partIndex}）
3. Seal 输入（POST /api/v1/tasks/{taskId}/seal）
4. 启动任务（POST /api/v1/tasks/{taskId}/start）
5. 轮询任务状态（GET /api/v1/tasks/{taskId}）
6. 获取任务结果（GET /api/v1/tasks/{taskId}/result）
7. 取消任务（POST /api/v1/tasks/{taskId}/cancel）

### 2.2 本阶段不做的事情

本阶段不修改其他 CLI 功能（除视频上传外）。

### 2.3 旧接口处理

本阶段必须完成视频上传接口的完整切换：
- 新接口实现完成后，立即替换旧接口的调用点
- 旧的同步上传实现代码在阶段 4 内移除
- 阶段 5 只负责清理残留的无用代码和文档更新

本阶段的职责是把 CLI 改造为任务客户端，并让视频上传功能完全运行在新任务框架之上。

---

## 3. 核心设计原则

### 3.1 任务式调用模式

CLI 不再使用同步阻塞式调用，而是：

- 创建任务获取 taskId
- 异步上传数据
- 启动任务后轮询状态
- 任务完成后获取结果

### 3.2 分片上传

大文件（如视频）必须分片上传：

- 固定分片大小（如 5MB）
- 支持并发上传多个分片
- 显示上传进度
- 支持失败重试

### 3.3 用户体验

- 显示清晰的进度信息
- 支持 Ctrl+C 取消任务
- 错误信息友好明确
- 支持 verbose 模式显示详细日志

---

## 4. 模块设计

### 4.1 TaskClient（任务客户端）

新建 `localBridge/clawBotCli/utils/task_client.py`

**职责：**
- 封装所有任务 REST API 调用
- 实现任务创建、启动、查询、取消
- 实现轮询逻辑
- 处理错误和重试

**核心接口：**

```python
class TaskClient:
    def __init__(self, base_url: str = "http://localhost:8080", config_path: str = None):
        self.base_url = base_url
        self.session = requests.Session()
        self.config = self._load_config(config_path)
    
    def _load_config(self, config_path: str = None) -> dict:
        """
        加载配置文件，获取默认 instanceId
        配置文件路径: ~/.aihub/config.json
        """
        if config_path is None:
            config_path = os.path.expanduser("~/.aihub/config.json")
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def get_default_instance_id(self, client_name: str) -> str:
        """
        获取默认 instanceId
        从配置文件读取，如果不存在则抛出异常
        """
        instances = self.config.get('instances', {})
        instance_id = instances.get(client_name)
        if not instance_id:
            raise ValueError(
                f"No default instanceId configured for {client_name}. "
                f"Please set it in ~/.aihub/config.json"
            )
        return instance_id
    
    def create_task(
        self,
        client_name: str,
        instance_id: str,
        task_kind: str,
        input_mode: str,
        params: dict
    ) -> str:
        """创建任务，返回 taskId"""
        pass
    
    def upload_input_part(
        self,
        task_id: str,
        part_index: int,
        data: bytes
    ) -> None:
        """上传输入分片"""
        pass
    
    def seal_input(
        self,
        task_id: str,
        total_parts: int,
        total_bytes: int,
        content_type: str
    ) -> None:
        """完成输入上传"""
        pass
    
    def start_task(self, task_id: str) -> None:
        """启动任务"""
        pass
    
    def get_task_status(self, task_id: str) -> dict:
        """查询任务状态"""
        pass
    
    def wait_for_completion(
        self,
        task_id: str,
        poll_interval: float = 2.0,
        timeout: float = 300.0,
        progress_callback: Optional[Callable] = None
    ) -> dict:
        """等待任务完成，返回任务状态"""
        pass
    
    def get_task_result(self, task_id: str) -> bytes:
        """获取任务结果"""
        pass
    
    def cancel_task(self, task_id: str) -> None:
        """取消任务"""
        pass
```

---

### 4.2 ChunkedUploader（分片上传器）

新建 `localBridge/clawBotCli/utils/chunked_uploader.py`

**职责：**
- 将文件切分为固定大小的分片
- 并发上传多个分片
- 显示上传进度
- 实现失败重试

**核心接口：**

```python
class ChunkedUploader:
    def __init__(
        self,
        task_client: TaskClient,
        chunk_size: int = 5 * 1024 * 1024,  # 5MB
        max_workers: int = 4,  # 在飞上传请求数上限
        retry_count: int = 3
    ):
        self.task_client = task_client
        self.chunk_size = chunk_size
        self.max_workers = max_workers  # 并发度：同时在飞的上传请求数
        self.retry_count = retry_count
    
    def upload_file(
        self,
        task_id: str,
        file_path: str,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[int, int, str]:
        """
        上传文件
        返回：(total_parts, total_bytes, content_type)
        """
        pass
    
    def _upload_chunk(
        self,
        task_id: str,
        part_index: int,
        data: bytes,
        retry_count: int = 3
    ) -> None:
        """上传单个分片，支持重试"""
        pass
    
    def _detect_content_type(self, file_path: str) -> str:
        """
        检测文件的 MIME 类型
        使用 Python 标准库 mimetypes
        """
        import mimetypes
        content_type, _ = mimetypes.guess_type(file_path)
        return content_type or 'application/octet-stream'
```

**并发模型约束（关键）：**

- **并发度定义**：`max_workers` 表示"同时在飞的上传请求数"，不是线程池大小
- **受控窗口上传**：任何时刻最多只允许 `max_workers` 个分片在上传中
- **读取推进规则**：只有某个分片上传成功确认后，才从文件读取下一个分片
- **进度触发时机**：进度回调在分片上传成功确认时触发，不是提交时触发
- **快速失败**：一旦任一分片失败，立即停止继续读取文件

**实现要点（受控窗口模型）：**

```python
def upload_file(self, task_id: str, file_path: str, progress_callback=None):
    file_size = os.path.getsize(file_path)
    total_parts = math.ceil(file_size / self.chunk_size)
    content_type = self._detect_content_type(file_path)
    
    with open(file_path, 'rb') as f:
        # 使用受控窗口模型：最多 max_workers 个在飞请求
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {}  # {future: part_index}
            part_index = 0
            uploaded_count = 0
            
            # 初始填充窗口
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
                        for f in futures.keys():
                            f.cancel()
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
```

---

### 4.3 ProgressDisplay（进度显示器）

新建 `localBridge/clawBotCli/utils/progress_display.py`

**职责：**
- 显示上传进度
- 显示任务执行进度
- 支持多种显示模式（简单/详细）

**核心接口：**

```python
class ProgressDisplay:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.lock = threading.Lock()
    
    def show_upload_progress(
        self,
        current: int,
        total: int,
        file_name: str
    ) -> None:
        """显示上传进度"""
        pass
    
    def show_task_progress(
        self,
        state: str,
        phase: str,
        progress: float
    ) -> None:
        """显示任务执行进度"""
        pass
    
    def show_error(self, error_code: str, error_message: str) -> None:
        """显示错误信息"""
        pass
```

**实现要点：**

```python
def show_upload_progress(self, current: int, total: int, file_name: str):
    with self.lock:
        percent = (current / total) * 100
        bar_length = 40
        filled = int(bar_length * current / total)
        bar = '=' * filled + '-' * (bar_length - filled)
        
        print(f'\rUploading {file_name}: [{bar}] {percent:.1f}% ({current}/{total} chunks)', end='')
        
        if current == total:
            print()  # 换行

def show_task_progress(self, state: str, phase: str, progress: float):
    with self.lock:
        if state == 'running':
            percent = progress * 100
            print(f'\rTask {state}: {phase} - {percent:.1f}%', end='')
        else:
            print(f'\nTask {state}: {phase}')
```

---

### 4.4 MediaUploadTask（视频上传任务）

修改 `localBridge/clawBotCli/utils/api_client.py`

**职责：**
- 使用 TaskClient 实现视频上传
- 替代旧的同步上传接口
- 提供友好的用户体验

**核心接口：**

```python
class MediaUploadTask:
    def __init__(
        self,
        task_client: TaskClient,
        uploader: ChunkedUploader,
        progress: ProgressDisplay
    ):
        self.task_client = task_client
        self.uploader = uploader
        self.progress = progress
    
    def upload_video(
        self,
        video_path: str,
        client_name: str = "tweetClaw",
        instance_id: str = None,
        tab_id: int = None
    ) -> str:
        """
        上传视频并返回 media_id
        
        Args:
            video_path: 视频文件路径
            client_name: 客户端名称，默认 "tweetClaw"
            instance_id: 实例 ID，如果为 None 则从配置文件读取默认值
            tab_id: 标签页 ID
        
        Returns:
            media_id: 上传成功后的媒体 ID
        
        Raises:
            ValueError: 如果 instance_id 为 None 且配置文件中没有默认值
        """
        pass
```

**实现要点：**

```python
def upload_video(self, video_path: str, client_name: str, instance_id: str, tab_id: int):
    task_id = None
    try:
        # 获取 instance_id (如果未提供则从配置读取)
        if not instance_id:
            instance_id = self.task_client.get_default_instance_id(client_name)
        
        # 1. 创建任务
        print(f"Creating upload task for {os.path.basename(video_path)}...")
        task_id = self.task_client.create_task(
            client_name=client_name,
            instance_id=instance_id,
            task_kind="x.media_upload",
            input_mode="chunked_binary",
            params={
                "tabId": tab_id
            }
        )
        print(f"Task created: {task_id}")
        
        # 2. 分片上传
        print(f"Uploading video...")
        total_parts, total_bytes, content_type = self.uploader.upload_file(
            task_id,
            video_path,
            progress_callback=lambda c, t: self.progress.show_upload_progress(
                c, t, os.path.basename(video_path)
            )
        )
        
        # 3. Seal 输入
        print("Finalizing upload...")
        self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
        
        # 4. 启动任务
        print("Starting upload task...")
        self.task_client.start_task(task_id)
        
        # 5. 等待完成
        print("Processing video...")
        result = self.task_client.wait_for_completion(
            task_id,
            poll_interval=2.0,
            timeout=300.0,
            progress_callback=lambda state, phase, prog: 
                self.progress.show_task_progress(state, phase, prog)
        )
        
        if result['state'] == 'completed':
            # 6. 获取结果
            result_data = self.task_client.get_task_result(task_id)
            result_json = json.loads(result_data)
            media_id = result_json['mediaId']
            print(f"\nUpload completed! Media ID: {media_id}")
            return media_id
        else:
            error_msg = result.get('errorMessage', 'Unknown error')
            raise Exception(f"Upload failed: {error_msg}")
    
    except KeyboardInterrupt:
        if task_id:
            print("\n\nCancelling upload...")
            try:
                self.task_client.cancel_task(task_id)
                print("Upload cancelled.")
            except Exception as e:
                print(f"Failed to cancel task: {e}")
        raise
    except Exception as e:
        if task_id:
            print(f"\nUpload failed: {e}")
            # 尝试取消任务
            try:
                self.task_client.cancel_task(task_id)
            except:
                pass
        raise
```

---

## 5. 代码改动范围

### 5.1 新增文件

- `localBridge/clawBotCli/utils/task_client.py` - 任务客户端
- `localBridge/clawBotCli/utils/chunked_uploader.py` - 分片上传器
- `localBridge/clawBotCli/utils/progress_display.py` - 进度显示器

### 5.2 修改现有文件

- `localBridge/clawBotCli/utils/api_client.py`
  - 添加 MediaUploadTask 类
  - 替换旧的上传接口调用点
  - 删除旧的同步上传实现代码
- `localBridge/clawBotCli/tests/test_publish.py`
  - 更新测试用例使用新接口

### 5.3 删除的代码

阶段 4 内必须删除：
- 旧的同步视频上传实现函数
- 旧的同步桥接调用逻辑
- 相关的旧接口文档注释

---

## 6. 实施顺序

### 6.1 第一组：基础设施（2.5 天）

**任务 4.1：实现 TaskClient 基础类（1.5 天）**

**步骤 4.1.1：创建配置管理（0.5 天）**

文件：`localBridge/clawBotCli/utils/task_client.py`

实现内容：
- 实现 `_load_config()` 方法，从 `~/.aihub/config.json` 读取配置
- 实现 `get_default_instance_id()` 方法，获取默认 instanceId
- 配置文件不存在时返回空字典，不抛出异常
- instanceId 缺失时抛出清晰的 ValueError

验收标准：
- [ ] 配置文件不存在时返回空字典
- [ ] 配置文件存在时正确解析 JSON
- [ ] `get_default_instance_id()` 在配置缺失时抛出清晰错误

**步骤 4.1.2：实现任务创建和输入上传（0.5 天）**

实现内容：
- `create_task()` - POST /api/v1/tasks，返回 taskId
- `upload_input_part()` - PUT /api/v1/tasks/{taskId}/input/{partIndex}
- `seal_input()` - POST /api/v1/tasks/{taskId}/seal
- 所有方法使用 `self.session` 发送请求
- HTTP 错误使用 `response.raise_for_status()` 抛出异常

验收标准：
- [ ] 创建任务成功返回 taskId
- [ ] 上传分片成功无异常
- [ ] Seal 输入成功无异常
- [ ] HTTP 错误正确抛出异常

**步骤 4.1.3：实现任务控制和查询（0.5 天）**

实现内容：
- `start_task()` - POST /api/v1/tasks/{taskId}/start
- `get_task_status()` - GET /api/v1/tasks/{taskId}
- `get_task_result()` - GET /api/v1/tasks/{taskId}/result
- `cancel_task()` - POST /api/v1/tasks/{taskId}/cancel
- `wait_for_completion()` - 轮询任务状态，支持超时和 Ctrl+C

验收标准：
- [ ] 启动任务成功
- [ ] 查询状态返回正确的 JSON
- [ ] 获取结果返回二进制数据
- [ ] 取消任务成功
- [ ] 轮询逻辑正确处理超时和 KeyboardInterrupt
- [ ] 超时时自动取消任务
- [ ] Ctrl+C 时自动取消任务

---

**任务 4.2：实现 ChunkedUploader（1 天）**

**步骤 4.2.1：实现文件分片和 MIME 检测（0.5 天）**

文件：`localBridge/clawBotCli/utils/chunked_uploader.py`

实现内容：
- 实现 `_detect_content_type()` 方法，使用 `mimetypes.guess_type()`
- 未知类型返回 `application/octet-stream`
- 初始化时接收 `chunk_size`、`max_workers`、`retry_count` 参数

验收标准：
- [ ] 正确检测 .mp4 为 video/mp4
- [ ] 正确检测 .mov 为 video/quicktime
- [ ] 未知类型返回 application/octet-stream

**步骤 4.2.2：实现受控窗口并发上传（0.5 天）**

实现内容：
- `upload_file()` - 使用受控窗口模型并发上传
- 使用 `concurrent.futures.wait()` 等待任一 future 完成
- 维护 `futures` 字典：`{future: part_index}`
- 只有上传成功确认后才读取下一个分片
- `_upload_chunk()` - 支持重试，指数退避最大 5 秒
- 实现快速失败：一旦有分片失败立即取消其他上传

并发模型强约束：
- 任何时刻最多 `max_workers` 个分片在上传中
- 文件读取不得领先于在飞窗口上限
- 进度回调在上传成功确认时触发

验收标准：
- [ ] 文件正确分片
- [ ] 受控窗口模型正确实现（最多 max_workers 个在飞）
- [ ] 文件读取不会一次性读完所有分片
- [ ] 失败重试生效（指数退避，最大 5 秒）
- [ ] 快速失败机制生效
- [ ] 进度回调在成功确认时触发
- [ ] 大文件（200MB+）内存占用 < 100MB

---

**任务 4.3：实现 ProgressDisplay（0.5 天）**

文件：`localBridge/clawBotCli/utils/progress_display.py`

实现内容：
- 实现 `show_upload_progress()` - 显示上传进度条
- 实现 `show_task_progress()` - 显示任务执行进度
- 实现 `show_error()` - 显示错误信息
- 使用 `threading.Lock()` 保证线程安全

验收标准：
- [ ] 进度条正确显示（40 字符宽度）
- [ ] 线程安全（多线程调用不混乱）
- [ ] 完成时正确换行
- [ ] 错误信息格式正确

---

### 6.2 第二组：业务集成（1.5 天）

**任务 4.4：实现 MediaUploadTask（1 天）**

文件：`localBridge/clawBotCli/utils/api_client.py`

**步骤 4.4.1：实现完整上传流程（0.7 天）**

实现内容：
- 创建 MediaUploadTask 类，接收 task_client、uploader、progress 参数
- 实现 `upload_video()` 方法，完整实现 6 步上传流程：
  1. 获取 instance_id（从参数或配置）
  2. 创建任务
  3. 分片上传（带进度回调）
  4. Seal 输入
  5. 启动任务
  6. 等待完成并获取结果
- 每个步骤打印清晰的状态信息

验收标准：
- [ ] 完整上传流程成功
- [ ] 每个步骤都有状态输出
- [ ] 成功返回 media_id
- [ ] 失败抛出清晰的异常

**步骤 4.4.2：实现错误处理和取消（0.3 天）**

实现内容：
- 捕获 KeyboardInterrupt，取消任务并打印提示
- 捕获其他异常，尝试取消任务（静默失败）
- 所有异常都重新抛出，不吞掉错误

验收标准：
- [ ] Ctrl+C 时正确取消任务
- [ ] 异常时尝试取消任务
- [ ] 错误信息清晰

---

**任务 4.5：更新测试用例和删除旧接口（0.5 天）**

文件：`localBridge/clawBotCli/tests/test_publish.py`、`localBridge/clawBotCli/utils/api_client.py`

**步骤 4.5.1：更新测试用例（0.3 天）**

实现内容：
- 使用 unittest.mock 创建 Mock 对象
- 测试成功场景：完整上传流程
- 测试失败场景：任务失败
- 测试取消场景：KeyboardInterrupt
- 验证所有方法调用顺序和参数

验收标准：
- [ ] 成功场景测试通过
- [ ] 失败场景测试通过
- [ ] 取消场景测试通过
- [ ] Mock 验证正确

**步骤 4.5.2：删除旧同步上传接口（0.2 天）**

实现内容：
- 识别并删除旧的同步视频上传函数
- 删除旧的同步桥接调用逻辑
- 更新所有调用点使用新的 MediaUploadTask
- 删除相关的旧接口文档注释

验收标准：
- [ ] 旧同步上传代码已完全删除
- [ ] 所有调用点已切换到新接口
- [ ] 编译通过，无引用错误
- [ ] 测试通过

---

**任务 4.6：集成测试（0.5 天）**

文件：`localBridge/clawBotCli/tests/integration_test.py`

测试用例：
1. 端到端视频上传测试
   - 上传小文件（< 10MB）
   - 上传大文件（200MB+）
   - 验证 media_id 返回
2. 网络中断测试
   - 模拟上传过程中网络中断
   - 验证重试机制
3. 任务取消测试
   - 上传过程中按 Ctrl+C
   - 验证任务被取消
4. 错误场景测试
   - 插件离线
   - 任务超时
   - 配置缺失

验收标准：
- [ ] 所有测试用例通过
- [ ] 视频上传功能正常（a.mp4, b.mov）
- [ ] 大文件上传稳定（200MB+）
- [ ] 内存占用 < 100MB

---

## 7. 详细代码实现

### 7.1 TaskClient 完整实现

```python
import os
import json
import time
import logging
import requests
from typing import Optional, Callable, Dict, Any

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
        """获取默认 instanceId"""
        instances = self.config.get('instances', {})
        instance_id = instances.get(client_name)
        if not instance_id:
            raise ValueError(
                f"No default instanceId configured for {client_name}. "
                f"Please set it in ~/.aihub/config.json"
            )
        return instance_id
    
    def create_task(
        self,
        client_name: str,
        instance_id: str,
        task_kind: str,
        input_mode: str,
        params: dict
    ) -> str:
        """创建任务，返回 taskId"""
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
        
        result = response.json()
        return result['taskId']
    
    def upload_input_part(
        self,
        task_id: str,
        part_index: int,
        data: bytes
    ) -> None:
        """上传输入分片"""
        url = f"{self.base_url}/api/v1/tasks/{task_id}/input/{part_index}"
        headers = {'Content-Type': 'application/octet-stream'}
        
        response = self.session.put(url, data=data, headers=headers)
        response.raise_for_status()
    
    def seal_input(
        self,
        task_id: str,
        total_parts: int,
        total_bytes: int,
        content_type: str
    ) -> None:
        """完成输入上传"""
        url = f"{self.base_url}/api/v1/tasks/{task_id}/seal"
        payload = {
            "totalParts": total_parts,
            "totalBytes": total_bytes,
            "contentType": content_type
        }
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
    
    def start_task(self, task_id: str) -> None:
        """启动任务"""
        url = f"{self.base_url}/api/v1/tasks/{task_id}/start"
        response = self.session.post(url)
        response.raise_for_status()
    
    def get_task_status(self, task_id: str) -> dict:
        """查询任务状态"""
        url = f"{self.base_url}/api/v1/tasks/{task_id}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def get_task_result(self, task_id: str) -> bytes:
        """获取任务结果"""
        url = f"{self.base_url}/api/v1/tasks/{task_id}/result"
        response = self.session.get(url)
        response.raise_for_status()
        return response.content
    
    def cancel_task(self, task_id: str) -> None:
        """取消任务"""
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
        """等待任务完成，返回任务状态"""
        start_time = time.time()
        last_progress = -1
        
        try:
            while True:
                # 检查超时
                if time.time() - start_time > timeout:
                    try:
                        self.cancel_task(task_id)
                        logging.info(f"Task {task_id} cancelled due to timeout")
                    except Exception as e:
                        logging.warning(f"Failed to cancel task on timeout: {e}")
                    raise TimeoutError(f"Task {task_id} timeout after {timeout}s")
                
                # 查询状态
                status = self.get_task_status(task_id)
                state = status['state']
                
                # 终态
                if state in ['completed', 'failed', 'cancelled']:
                    return status
                
                # 上报进度
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
```

### 7.2 ChunkedUploader 完整实现（受控窗口模型）

```python
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
        self.task_client = task_client
        self.chunk_size = chunk_size
        self.max_workers = max_workers
        self.retry_count = retry_count
    
    def _detect_content_type(self, file_path: str) -> str:
        """检测文件的 MIME 类型"""
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
        返回：(total_parts, total_bytes, content_type)
        """
        file_size = os.path.getsize(file_path)
        total_parts = math.ceil(file_size / self.chunk_size)
        content_type = self._detect_content_type(file_path)
        
        with open(file_path, 'rb') as f:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {}  # {future: part_index}
                part_index = 0
                uploaded_count = 0
                
                # 初始填充窗口
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
                            for f in futures.keys():
                                f.cancel()
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
        """上传单个分片，支持重试"""
        for attempt in range(retry_count):
            try:
                self.task_client.upload_input_part(task_id, part_index, data)
                return
            except requests.exceptions.RequestException as e:
                if attempt == retry_count - 1:
                    raise
                wait_time = min(2 ** attempt, 5)
                time.sleep(wait_time)
```

### 7.3 ProgressDisplay 完整实现

```python
import threading

class ProgressDisplay:
    """进度显示器"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.lock = threading.Lock()
    
    def show_upload_progress(
        self,
        current: int,
        total: int,
        file_name: str
    ) -> None:
        """显示上传进度"""
        with self.lock:
            percent = (current / total) * 100
            bar_length = 40
            filled = int(bar_length * current / total)
            bar = '=' * filled + '-' * (bar_length - filled)
            
            print(f'\rUploading {file_name}: [{bar}] {percent:.1f}% ({current}/{total} chunks)', end='')
            
            if current == total:
                print()
    
    def show_task_progress(
        self,
        state: str,
        phase: str,
        progress: float
    ) -> None:
        """显示任务执行进度"""
        with self.lock:
            if state == 'running':
                percent = progress * 100
                print(f'\rTask {state}: {phase} - {percent:.1f}%', end='')
            else:
                print(f'\nTask {state}: {phase}')
    
    def show_error(self, error_code: str, error_message: str) -> None:
        """显示错误信息"""
        with self.lock:
            print(f'\nError [{error_code}]: {error_message}')
```

### 7.4 MediaUploadTask 完整实现

```python
import os
import json

class MediaUploadTask:
    """视频上传任务"""
    
    def __init__(self, task_client, uploader, progress):
        self.task_client = task_client
        self.uploader = uploader
        self.progress = progress
    
    def upload_video(
        self,
        video_path: str,
        client_name: str = "tweetClaw",
        instance_id: str = None,
        tab_id: int = None
    ) -> str:
        """
        上传视频并返回 media_id
        
        Args:
            video_path: 视频文件路径
            client_name: 客户端名称
            instance_id: 实例 ID，如果为 None 则从配置文件读取
            tab_id: 标签页 ID
        
        Returns:
            media_id: 上传成功后的媒体 ID
        """
        task_id = None
        try:
            # 获取 instance_id
            if not instance_id:
                instance_id = self.task_client.get_default_instance_id(client_name)
            
            # 1. 创建任务
            print(f"Creating upload task for {os.path.basename(video_path)}...")
            task_id = self.task_client.create_task(
                client_name=client_name,
                instance_id=instance_id,
                task_kind="x.media_upload",
                input_mode="chunked_binary",
                params={"tabId": tab_id}
            )
            print(f"Task created: {task_id}")
            
            # 2. 分片上传
            print("Uploading video...")
            total_parts, total_bytes, content_type = self.uploader.upload_file(
                task_id,
                video_path,
                progress_callback=lambda c, t: self.progress.show_upload_progress(
                    c, t, os.path.basename(video_path)
                )
            )
            
            # 3. Seal 输入
            print("Finalizing upload...")
            self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
            
            # 4. 启动任务
            print("Starting upload task...")
            self.task_client.start_task(task_id)
            
            # 5. 等待完成
            print("Processing video...")
            result = self.task_client.wait_for_completion(
                task_id,
                poll_interval=2.0,
                timeout=300.0,
                progress_callback=lambda state, phase, prog: 
                    self.progress.show_task_progress(state, phase, prog)
            )
            
            if result['state'] == 'completed':
                # 6. 获取结果
                result_data = self.task_client.get_task_result(task_id)
                result_json = json.loads(result_data)
                media_id = result_json['mediaId']
                print(f"\nUpload completed! Media ID: {media_id}")
                return media_id
            else:
                error_msg = result.get('errorMessage', 'Unknown error')
                raise Exception(f"Upload failed: {error_msg}")
        
        except KeyboardInterrupt:
            if task_id:
                print("\n\nCancelling upload...")
                try:
                    self.task_client.cancel_task(task_id)
                    print("Upload cancelled.")
                except Exception as e:
                    print(f"Failed to cancel task: {e}")
            raise
        except Exception as e:
            if task_id:
                print(f"\nUpload failed: {e}")
                try:
                    self.task_client.cancel_task(task_id)
                except:
                    pass
            raise
```

### 7.5 测试用例实现

```python
import unittest
from unittest.mock import Mock, patch
from utils.task_client import TaskClient
from utils.chunked_uploader import ChunkedUploader
from utils.progress_display import ProgressDisplay
from utils.api_client import MediaUploadTask

class TestMediaUploadTask(unittest.TestCase):
    
    def setUp(self):
        self.task_client = Mock(spec=TaskClient)
        self.uploader = Mock(spec=ChunkedUploader)
        self.progress = Mock(spec=ProgressDisplay)
        self.media_upload = MediaUploadTask(
            self.task_client,
            self.uploader,
            self.progress
        )
    
    def test_upload_video_success(self):
        """测试视频上传成功"""
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.return_value = {'state': 'completed'}
        self.task_client.get_task_result.return_value = b'{"mediaId": "media_456"}'
        
        media_id = self.media_upload.upload_video(
            "test.mp4",
            instance_id="instance_xxx",
            tab_id=123
        )
        
        self.assertEqual(media_id, "media_456")
        self.task_client.create_task.assert_called_once()
        self.task_client.seal_input.assert_called_once()
        self.task_client.start_task.assert_called_once()
    
    def test_upload_video_failure(self):
        """测试视频上传失败"""
        self.task_client.create_task.return_value = "task_123"
        self.uploader.upload_file.return_value = (10, 50000000, "video/mp4")
        self.task_client.wait_for_completion.return_value = {
            'state': 'failed',
            'errorMessage': 'Network error'
        }
        
        with self.assertRaises(Exception) as context:
            self.media_upload.upload_video(
                "test.mp4",
                instance_id="instance_xxx",
                tab_id=123
            )
        
        self.assertIn('Network error', str(context.exception))
```

## 8. 关键实现细节

### 8.1 轮询策略

```python
def wait_for_completion(self, task_id: str, poll_interval: float, timeout: float, progress_callback):
    start_time = time.time()
    last_progress = -1
    
    try:
        while True:
            # 检查超时
            if time.time() - start_time > timeout:
                # 超时后尝试取消任务
                try:
                    self.cancel_task(task_id)
                    log.info(f"Task {task_id} cancelled due to timeout")
                except Exception as e:
                    log.warning(f"Failed to cancel task on timeout: {e}")
                raise TimeoutError(f"Task {task_id} timeout after {timeout}s")
            
            # 查询状态
            status = self.get_task_status(task_id)
            state = status['state']
            
            # 终态
            if state in ['completed', 'failed', 'cancelled']:
                return status
            
            # 上报进度（避免重复上报）
            if progress_callback and status.get('progress', 0) != last_progress:
                progress_callback(state, status.get('phase', ''), status.get('progress', 0))
                last_progress = status.get('progress', 0)
            
            # 等待下次轮询
            time.sleep(poll_interval)
    
    except KeyboardInterrupt:
        # Ctrl+C 时取消任务
        try:
            self.cancel_task(task_id)
            log.info(f"Task {task_id} cancelled by user")
        except Exception as e:
            log.warning(f"Failed to cancel task: {e}")
        raise
```

---

## 9. 与主任务拆解的映射关系

本计划中的任务编号是对 [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md) 阶段 4（任务卡 4.1-4.5）的实施级细分。

**映射关系：**

| 本计划任务 | 主任务拆解 | 说明 |
|-----------|-----------|------|
| 4.1 实现 TaskClient 基础类 | 4.1 实现 TaskClient 基础类 | 直接对应 |
| 4.2 实现 ChunkedUploader | 4.2 实现分片上传逻辑 | 直接对应 |
| 4.3 实现 ProgressDisplay | - | 新增的用户体验模块 |
| 4.4 实现 MediaUploadTask | 4.3 重构视频上传接口 | 直接对应 |
| 4.5 更新测试用例 | 4.4 更新测试用例 | 直接对应 |
| 4.6 集成测试 | 4.5 阶段 4 集成测试 | 直接对应 |

---

## 10. 测试计划

### 10.1 单元测试

- TaskClient 测试
  - 所有 API 调用方法
  - 错误处理和重试
  - 超时处理
- ChunkedUploader 测试
  - 文件分片逻辑
  - 并发上传
  - 失败重试
- ProgressDisplay 测试
  - 进度显示格式
  - 不同状态的显示

### 10.2 集成测试

- 视频上传完整流程
  - 小文件（< 10MB）
  - 大文件（200MB+）
- 网络不稳定场景
  - 上传过程中网络中断（验证重试机制）
  - 任务执行过程中网络中断
- 任务取消场景
  - 上传过程中取消
  - 任务执行过程中取消
- 错误场景
  - 插件离线
  - 任务失败
  - 超时

### 10.3 性能测试

- 大文件上传性能
  - 上传 1GB 文件的时间和内存占用
  - 并发上传 10 个文件的吞吐量
  - 网络带宽利用率
- 分片上传效率
  - 不同分片大小的性能对比（1MB vs 5MB vs 10MB）
  - 不同并发数的性能对比（2 vs 4 vs 8）

### 10.4 验收标准

- 所有测试用例通过
- 视频上传功能正常（a.mp4, b.mov）
- 进度显示友好
- 错误信息清晰
- 支持 Ctrl+C 取消
- 大文件上传稳定（200MB+）
- 上传 1GB 文件内存占用 < 100MB
- 并发上传 10 个文件无内存泄漏

---

## 11. 配置管理

### 11.1 配置文件格式

配置文件路径：`~/.aihub/config.json`

```json
{
  "base_url": "http://localhost:8080",
  "instances": {
    "tweetClaw": "instance_xxx"
  },
  "upload": {
    "chunk_size": 5242880,
    "max_workers": 4,
    "retry_count": 3,
    "poll_interval": 2.0,
    "timeout": 300.0
  }
}
```

### 11.2 配置项说明

- `base_url`: Go 服务的基础 URL，默认 `http://localhost:8080`
- `instances`: 各客户端的默认实例 ID
- `upload.chunk_size`: 分片大小（字节），默认 5MB
- `upload.max_workers`: 在飞上传请求数上限，默认 4
- `upload.retry_count`: 失败重试次数，默认 3
- `upload.poll_interval`: 轮询间隔（秒），默认 2.0
- `upload.timeout`: 任务超时时间（秒），默认 300.0

---

## 12. 风险和缓解措施

### 风险 1：并发上传导致内存压力

**风险：** 并发读取多个分片可能占用大量内存

**缓解措施：**
- 使用受控窗口模型限制在飞请求数（默认 4 个，可配置）
- 只有上传成功确认后才读取下一个分片
- 及时释放已上传分片的内存
- 实现快速失败策略，避免无效上传
- 保证大文件（200MB+）内存占用 < 100MB

### 风险 2：轮询频率过高

**风险：** 轮询间隔太短可能给服务器带来压力

**缓解措施：**
- 默认轮询间隔 2 秒（可配置）
- 支持通过配置文件调整轮询间隔
- 未来可考虑使用 WebSocket 推送（阶段 5 二期工程）

### 风险 3：网络不稳定导致上传失败

**风险：** 网络中断可能导致部分分片上传失败

**缓解措施：**
- 实现失败重试机制（最多 3 次，指数退避最大 5 秒）
- 快速失败：一旦分片失败立即停止读取文件
- 显示清晰的错误信息

### 风险 4：用户体验不佳

**风险：** 长时间上传没有反馈让用户焦虑

**缓解措施：**
- 显示详细的进度信息（使用线程锁保证输出不混乱）
- 支持 verbose 模式显示更多细节
- 提供清晰的错误信息和建议
- 超时和 Ctrl+C 时自动取消任务

### 风险 5：instanceId 配置缺失

**风险：** 用户未配置 instanceId 导致任务创建失败

**缓解措施：**
- 提供清晰的错误提示，说明如何配置
- 在文档中明确说明配置文件格式
- 提供配置文件示例

---

## 13. 开发完成判定

阶段 4 只有同时满足以下条件才算完成：

1. TaskClient、ChunkedUploader、ProgressDisplay 已实现
2. MediaUploadTask 已实现
3. 测试用例已更新
4. 集成测试跑通完整上传闭环
5. 视频上传功能正常（a.mp4, b.mov）
6. 大文件上传稳定（200MB+）
7. 用户体验良好（进度显示、错误提示、取消支持）

在此之前，不认为阶段 4 完成。

---

## 13. 与阶段 2、3 的依赖关系

阶段 4 依赖阶段 2 和阶段 3 的以下成果：

**阶段 2（Go 侧）：**
- ✅ REST API（9 个端点）
- ✅ Task Data Store（输入数据存储）
- ✅ Task Result Store（结果数据存储）
- ✅ Long Task Manager（任务生命周期管理）

**阶段 3（插件侧）：**
- ✅ TaskExecutor（任务执行器）
- ✅ MediaUploadExecutor（视频上传执行器）
- ✅ 任务取消机制
- ✅ 结果上传机制

阶段 2 和阶段 3 已完成并通过验收，阶段 4 可以开始。

---

## 14. 后续阶段预览

### 阶段 5：清理旧实现

- 删除旧的同步上传接口
- 删除旧的控制面大 payload 传输逻辑
- 更新文档
- 最终验收测试

---

**评审人：待定**  
**评审日期：待定**
