#!/usr/bin/env python3
"""
通用数据导入框架

使用方法:
    python3 scripts/import-lali-direct.py [选项]

选项:
    --config=PATH       配置文件路径（JSON 格式）
    --source=PATH       源数据库路径
    --target=PATH       目标数据库路径
    --dry-run           只生成数据，不执行写入
    --validate-only     只验证数据，不导入
    --verbose           显示详细日志
    --batch-size=N      批处理大小（默认 500）
    --log-file=PATH     日志文件路径
    --incremental       增量导入（只导入新数据）
    --export=PATH       导出数据到 JSON 文件
    --sync              同步模式（更新已存在的记录）
    --checkpoint=PATH   断点续传文件路径
    --preview           预览模式（显示前 10 条数据）
    --rollback          回滚上一次导入
    --stats             显示数据统计
"""

import sqlite3
import hashlib
import os
import sys
import json
import re
import logging
import time
import threading
import csv
from abc import ABC, abstractmethod
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Set, Type, Union
from pathlib import Path
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import StringIO

# ============================================================================
# 颜色输出
# ============================================================================

class Colors:
    """ANSI 颜色代码"""
    RESET = '\033[0m'
    BOLD = '\033[1m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'

    @staticmethod
    def is_supported() -> bool:
        """检查终端是否支持颜色"""
        return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()


def colorize(text: str, color: str) -> str:
    """给文本添加颜色"""
    if Colors.is_supported():
        return f'{color}{text}{Colors.RESET}'
    return text


# ============================================================================
# 工具函数
# ============================================================================

def generate_uuid(seed: str) -> str:
    """生成确定性 UUID"""
    uuid_hex = hashlib.md5(seed.encode()).hexdigest()
    return f'{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:32]}'


def parse_timestamp(ts_str: Optional[str]) -> int:
    """解析时间戳字符串为毫秒级时间戳"""
    if not ts_str:
        return int(datetime.now().timestamp() * 1000)

    try:
        dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        return int(dt.timestamp() * 1000)
    except (ValueError, TypeError):
        pass

    try:
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S']:
            try:
                dt = datetime.strptime(ts_str, fmt)
                return int(dt.timestamp() * 1000)
            except ValueError:
                continue
    except Exception:
        pass

    return int(datetime.now().timestamp() * 1000)


def sanitize_html(html: Optional[str]) -> Optional[str]:
    """清理 HTML 内容"""
    if not html:
        return None

    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)

    return html.strip()


def validate_json(json_str: Optional[str]) -> Optional[str]:
    """验证并规范化 JSON 字符串"""
    if not json_str:
        return None

    try:
        data = json.loads(json_str)
        return json.dumps(data, ensure_ascii=False)
    except json.JSONDecodeError:
        return None


def safe_float(value: Any, default: float = 0.0) -> float:
    """安全转换为浮点数"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    """安全转换为整数"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# ============================================================================
# 进度条
# ============================================================================

class ProgressBar:
    """进度条"""

    def __init__(self, total: int, desc: str = '', width: int = 50):
        self.total = total
        self.desc = desc
        self.width = width
        self.current = 0
        self.start_time = time.time()
        self._last_update = 0
        self._lock = threading.Lock()

    def update(self, n: int = 1):
        """更新进度"""
        with self._lock:
            self.current += n
            now = time.time()

            if now - self._last_update < 0.1 and self.current < self.total:
                return

            self._last_update = now
            self._display()

    def _display(self):
        """显示进度条"""
        if self.total == 0:
            return

        percent = self.current / self.total
        filled = int(self.width * percent)
        bar = '█' * filled + '░' * (self.width - filled)

        elapsed = time.time() - self.start_time
        if self.current > 0:
            eta = elapsed / self.current * (self.total - self.current)
            eta_str = self._format_time(eta)
        else:
            eta_str = '??:??'

        if percent < 0.3:
            bar_color = Colors.RED
        elif percent < 0.7:
            bar_color = Colors.YELLOW
        else:
            bar_color = Colors.GREEN

        colored_bar = colorize(bar, bar_color)
        percent_str = colorize(f'{percent:.1%}', Colors.BOLD)

        sys.stdout.write(f'\r   {self.desc} [{colored_bar}] {percent_str} {self.current}/{self.total} ETA: {eta_str}')
        sys.stdout.flush()

    def finish(self):
        """完成进度条"""
        with self._lock:
            self.current = self.total
            self._display()
            elapsed = time.time() - self.start_time
            elapsed_str = colorize(self._format_time(elapsed), Colors.CYAN)
            print(f' ({elapsed_str})')

    @staticmethod
    def _format_time(seconds: float) -> str:
        """格式化时间"""
        if seconds < 60:
            return f'{seconds:.0f}s'
        elif seconds < 3600:
            return f'{seconds // 60:.0f}m {seconds % 60:.0f}s'
        else:
            return f'{seconds // 3600:.0f}h {(seconds % 3600) // 60:.0f}m'


# ============================================================================
# 并行映射器
# ============================================================================

class ParallelMapper:
    """并行数据映射器"""

    def __init__(self, workers: int = 4, threshold: int = 1000):
        self.workers = workers
        self.threshold = threshold

    def map_batch(self, rows: List[Tuple], columns: List[str],
                  field_mappings: Dict[str, str],
                  transformations: Dict[str, str],
                  default_values: Dict[str, Any],
                  map_func) -> List[Dict]:
        """批量映射数据（自动选择并行或串行）"""
        if len(rows) < self.threshold:
            # 小批量串行处理
            return [map_func(row, columns, None, {'success': 0, 'failed': 0, 'warnings': 0})
                    for row in rows]

        # 大批量并行处理
        results = []
        chunk_size = max(1, len(rows) // self.workers)
        chunks = [rows[i:i + chunk_size] for i in range(0, len(rows), chunk_size)]

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = []
            for chunk in chunks:
                future = executor.submit(
                    self._map_chunk, chunk, columns, map_func
                )
                futures.append(future)

            for future in as_completed(futures):
                results.extend(future.result())

        return results

    def _map_chunk(self, rows: List[Tuple], columns: List[str], map_func) -> List[Dict]:
        """映射数据块"""
        stats = {'success': 0, 'failed': 0, 'warnings': 0}
        return [map_func(row, columns, None, stats) for row in rows]


# ============================================================================
# UUID缓存
# ============================================================================

class UUIDCache:
    """UUID缓存（线程安全）"""

    def __init__(self, max_size: int = 100000):
        self.max_size = max_size
        self._cache: Dict[str, str] = {}
        self._lock = threading.Lock()

    def get_or_generate(self, seed: str) -> str:
        """获取或生成UUID"""
        with self._lock:
            if seed in self._cache:
                return self._cache[seed]

            # 生成UUID
            uuid_hex = hashlib.md5(seed.encode()).hexdigest()
            uuid = f'{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:32]}'

            # 缓存（如果满了则跳过）
            if len(self._cache) < self.max_size:
                self._cache[seed] = uuid

            return uuid

    def clear(self):
        """清空缓存"""
        with self._lock:
            self._cache.clear()

    @property
    def size(self) -> int:
        """缓存大小"""
        return len(self._cache)


# ============================================================================
# 日志记录器
# ============================================================================

class Logger:
    """日志记录器"""

    def __init__(self, log_file: Optional[str] = None, verbose: bool = False):
        self.log_file = log_file
        self.verbose = verbose
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
        self._setup_logging()

    def _setup_logging(self):
        """配置日志"""
        self.logger = logging.getLogger('data-import')
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers.clear()

        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG if self.verbose else logging.INFO)
        console_format = logging.Formatter('%(message)s')
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)

        if self.log_file:
            file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)
            file_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(file_format)
            self.logger.addHandler(file_handler)

    def error(self, msg: str, context: Optional[Dict] = None):
        """记录错误"""
        error_info = {'message': msg, 'context': context or {}, 'timestamp': datetime.now().isoformat()}
        self.errors.append(error_info)
        self.logger.error(colorize(f'❌ {msg}', Colors.RED))
        if context and self.verbose:
            self.logger.debug(f'   上下文: {context}')

    def warning(self, msg: str, context: Optional[Dict] = None):
        """记录警告"""
        warning_info = {'message': msg, 'context': context or {}, 'timestamp': datetime.now().isoformat()}
        self.warnings.append(warning_info)
        self.logger.warning(colorize(f'⚠️  {msg}', Colors.YELLOW))

    def info(self, msg: str):
        """记录信息"""
        self.logger.info(msg)

    def success(self, msg: str):
        """记录成功信息"""
        self.logger.info(colorize(f'✅ {msg}', Colors.GREEN))

    def debug(self, msg: str):
        """记录调试信息"""
        self.logger.debug(f'   {msg}')

    def get_summary(self) -> Dict:
        """获取日志摘要"""
        return {
            'errors': len(self.errors),
            'warnings': len(self.warnings),
            'error_details': self.errors[:20],
            'warning_details': self.warnings[:20]
        }


# ============================================================================
# 检查点管理器
# ============================================================================

class CheckpointManager:
    """断点续传管理器"""

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.checkpoint_path = checkpoint_path
        self.data: Dict = {
            'last_table': None,
            'last_id': None,
            'completed_tables': [],
            'stats': {},
            'timestamp': None,
        }
        self._load()

    def _load(self):
        """加载检查点"""
        if not self.checkpoint_path or not os.path.exists(self.checkpoint_path):
            return

        try:
            with open(self.checkpoint_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
        except Exception:
            self.data = {}

    def save(self, table: str, last_id: Optional[str] = None, stats: Optional[Dict] = None):
        """保存检查点"""
        if not self.checkpoint_path:
            return

        self.data['last_table'] = table
        self.data['last_id'] = last_id
        self.data['timestamp'] = datetime.now().isoformat()

        if stats:
            self.data['stats'] = stats

        try:
            with open(self.checkpoint_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def mark_completed(self, table: str):
        """标记表完成"""
        if table not in self.data.get('completed_tables', []):
            self.data.setdefault('completed_tables', []).append(table)
            self.save(table)

    def is_completed(self, table: str) -> bool:
        """检查表是否已完成"""
        return table in self.data.get('completed_tables', [])

    def get_last_id(self, table: str) -> Optional[str]:
        """获取表的最后处理 ID"""
        if self.data.get('last_table') == table:
            return self.data.get('last_id')
        return None

    def clear(self):
        """清除检查点"""
        self.data = {}
        if self.checkpoint_path and os.path.exists(self.checkpoint_path):
            try:
                os.remove(self.checkpoint_path)
            except Exception:
                pass


# ============================================================================
# 配置管理
# ============================================================================

@dataclass
class TableMapping:
    """表映射配置"""
    source_table: str
    target_table: str
    field_mappings: Dict[str, str] = field(default_factory=dict)
    transformations: Dict[str, str] = field(default_factory=dict)
    default_values: Dict[str, Any] = field(default_factory=dict)
    required_fields: List[str] = field(default_factory=list)
    unique_fields: List[str] = field(default_factory=list)


@dataclass
class ImportConfig:
    """导入配置"""
    source_path: str = ''
    target_path: str = ''
    dry_run: bool = False
    validate_only: bool = False
    verbose: bool = False
    batch_size: int = 500
    log_file: Optional[str] = None
    incremental: bool = False
    export_path: Optional[str] = None
    sync_mode: bool = False
    checkpoint_path: Optional[str] = None
    preview: bool = False
    rollback: bool = False
    stats: bool = False
    table_mappings: List[TableMapping] = field(default_factory=list)
    uuid_prefix: str = 'import'
    clear_target: bool = True

    # 性能配置
    performance_mode: bool = True  # 启用高性能模式
    parallel_workers: int = 4  # 并行工作线程数
    parallel_threshold: int = 1000  # 启用并行的阈值
    uuid_cache_size: int = 100000  # UUID缓存大小
    disable_indexes: bool = True  # 导入时禁用索引

    @classmethod
    def from_file(cls, config_path: str) -> 'ImportConfig':
        """从配置文件加载"""
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        config = cls()
        config.source_path = data.get('source_path', '')
        config.target_path = data.get('target_path', '')
        config.dry_run = data.get('dry_run', False)
        config.validate_only = data.get('validate_only', False)
        config.verbose = data.get('verbose', False)
        config.batch_size = data.get('batch_size', 500)
        config.log_file = data.get('log_file')
        config.incremental = data.get('incremental', False)
        config.export_path = data.get('export_path')
        config.sync_mode = data.get('sync_mode', False)
        config.checkpoint_path = data.get('checkpoint_path')
        config.uuid_prefix = data.get('uuid_prefix', 'import')
        config.clear_target = data.get('clear_target', True)

        for mapping_data in data.get('table_mappings', []):
            mapping = TableMapping(
                source_table=mapping_data['source_table'],
                target_table=mapping_data['target_table'],
                field_mappings=mapping_data.get('field_mappings', {}),
                transformations=mapping_data.get('transformations', {}),
                default_values=mapping_data.get('default_values', {}),
                required_fields=mapping_data.get('required_fields', []),
                unique_fields=mapping_data.get('unique_fields', []),
            )
            config.table_mappings.append(mapping)

        return config

    @classmethod
    def from_args(cls, args: List[str]) -> 'ImportConfig':
        """从命令行参数加载"""
        config = cls()

        for arg in args:
            if arg == '--dry-run':
                config.dry_run = True
            elif arg == '--validate-only':
                config.validate_only = True
                config.dry_run = True
            elif arg == '--verbose':
                config.verbose = True
            elif arg == '--incremental':
                config.incremental = True
            elif arg == '--sync':
                config.sync_mode = True
            elif arg == '--preview':
                config.preview = True
            elif arg == '--rollback':
                config.rollback = True
            elif arg == '--stats':
                config.stats = True
            elif arg.startswith('--batch-size='):
                try:
                    config.batch_size = int(arg.split('=')[1])
                except ValueError:
                    print(f'无效的 batch-size: {arg}')
                    sys.exit(1)
            elif arg.startswith('--log-file='):
                config.log_file = arg.split('=', 1)[1]
            elif arg.startswith('--export='):
                config.export_path = arg.split('=', 1)[1]
            elif arg.startswith('--checkpoint='):
                config.checkpoint_path = arg.split('=', 1)[1]
            elif arg.startswith('--source='):
                config.source_path = arg.split('=', 1)[1]
            elif arg.startswith('--target='):
                config.target_path = arg.split('=', 1)[1]
            elif arg.startswith('--config='):
                return cls.from_file(arg.split('=', 1)[1])
            elif arg in ['-h', '--help']:
                print(__doc__)
                sys.exit(0)

        return config


# ============================================================================
# 数据验证器
# ============================================================================

class Validator:
    """数据验证器"""

    def __init__(self, logger: Logger):
        self.logger = logger

    def validate_record(self, data: Dict, mapping: TableMapping) -> Tuple[bool, List[str]]:
        """验证记录数据"""
        errors = []

        for field in mapping.required_fields:
            if not data.get(field):
                errors.append(f'缺少必填字段: {field}')

        if data.get('created_at') and not isinstance(data['created_at'], int):
            errors.append('created_at 必须是整数')
        if data.get('updated_at') and not isinstance(data['updated_at'], int):
            errors.append('updated_at 必须是整数')

        for field in ['images', 'specifications', 'options', 'options_values']:
            value = data.get(field)
            if value and isinstance(value, str):
                try:
                    json.loads(value)
                except json.JSONDecodeError:
                    errors.append(f'{field} 不是有效的 JSON')

        status = data.get('status')
        if status and status not in ('active', 'archived', 'normal', 'blocked', 'whitelisted', 'liked'):
            errors.append(f'无效的 status: {status}')

        price = data.get('price')
        if price is not None and price < 0:
            errors.append('price 不能为负数')

        return len(errors) == 0, errors


# ============================================================================
# 字段转换器
# ============================================================================

class FieldTransformer:
    """字段转换器"""

    @staticmethod
    def transform(value: Any, transform_type: str, **kwargs) -> Any:
        """转换字段值"""
        if transform_type == 'uuid':
            seed = kwargs.get('seed', str(value))
            prefix = kwargs.get('prefix', 'import')
            return generate_uuid(f'{prefix}-{seed}')
        elif transform_type == 'timestamp':
            return parse_timestamp(value)
        elif transform_type == 'html':
            return sanitize_html(value)
        elif transform_type == 'json':
            return validate_json(value)
        elif transform_type == 'float':
            default = kwargs.get('default', 0.0)
            return safe_float(value, default)
        elif transform_type == 'int':
            default = kwargs.get('default', 0)
            return safe_int(value, default)
        elif transform_type == 'slug':
            url = value
            fallback_id = kwargs.get('fallback_id', 'unknown')
            if not url:
                return f'product-{fallback_id}'
            url_path = url.rstrip('/')
            parts = url_path.split('/')
            slug = parts[-1] if parts else ''
            return slug if slug else f'product-{fallback_id}'
        elif transform_type == 'json_array':
            if isinstance(value, list):
                return json.dumps(value, ensure_ascii=False)
            return value or '[]'
        elif transform_type == 'mime_type':
            if not value:
                return 'image/jpeg'
            ext = value.lower().split('.')[-1] if '.' in str(value) else ''
            mime_map = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
            }
            return mime_map.get(ext, 'image/jpeg')
        elif transform_type == 'status':
            available = value
            return 'active' if available else 'archived'
        elif transform_type == 'stock':
            available = value
            return 100 if available else 0
        elif transform_type == 'suggested_price':
            price = safe_float(value)
            return price * 0.6 if price > 0 else 0
        else:
            return value


# ============================================================================
# 数据源抽象
# ============================================================================

class DataSource(ABC):
    """数据源抽象基类"""

    @abstractmethod
    def connect(self):
        """连接数据源"""
        pass

    @abstractmethod
    def disconnect(self):
        """断开数据源"""
        pass

    @abstractmethod
    def get_tables(self) -> List[str]:
        """获取所有表名"""
        pass

    @abstractmethod
    def get_table_count(self, table: str) -> int:
        """获取表的记录数"""
        pass

    @abstractmethod
    def read_table(self, table: str) -> Tuple[List[str], List[Tuple]]:
        """读取表数据，返回 (列名, 数据行)"""
        pass

    @abstractmethod
    def read_table_batch(self, table: str, offset: int, limit: int) -> Tuple[List[str], List[Tuple]]:
        """批量读取表数据"""
        pass


class SQLiteSource(DataSource):
    """SQLite 数据源"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        """连接数据库"""
        self.conn = sqlite3.connect(self.db_path)

    def disconnect(self):
        """断开数据库"""
        if self.conn:
            self.conn.close()

    def get_tables(self) -> List[str]:
        """获取所有表名"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        return [row[0] for row in cursor.fetchall()]

    def get_table_count(self, table: str) -> int:
        """获取表的记录数"""
        cursor = self.conn.cursor()
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        return cursor.fetchone()[0]

    def read_table(self, table: str) -> Tuple[List[str], List[Tuple]]:
        """读取表数据"""
        cursor = self.conn.cursor()
        cursor.execute(f'SELECT * FROM {table}')
        columns = [description[0] for description in cursor.description]
        rows = cursor.fetchall()
        return columns, rows

    def read_table_batch(self, table: str, offset: int, limit: int) -> Tuple[List[str], List[Tuple]]:
        """批量读取表数据"""
        cursor = self.conn.cursor()
        cursor.execute(f'SELECT * FROM {table} LIMIT {limit} OFFSET {offset}')
        columns = [description[0] for description in cursor.description]
        rows = cursor.fetchall()
        return columns, rows


class CSVSource(DataSource):
    """CSV 数据源"""

    def __init__(self, file_path: str, encoding: str = 'utf-8'):
        self.file_path = file_path
        self.encoding = encoding
        self.data = None
        self.columns = None

    def connect(self):
        """读取 CSV 文件"""
        with open(self.file_path, 'r', encoding=self.encoding) as f:
            reader = csv.reader(f)
            self.columns = next(reader)
            self.data = list(reader)

    def disconnect(self):
        """清理数据"""
        self.data = None
        self.columns = None

    def get_tables(self) -> List[str]:
        """返回文件名作为表名"""
        return [Path(self.file_path).stem]

    def get_table_count(self, table: str) -> int:
        """获取记录数"""
        return len(self.data) if self.data else 0

    def read_table(self, table: str) -> Tuple[List[str], List[Tuple]]:
        """读取数据"""
        return self.columns, self.data

    def read_table_batch(self, table: str, offset: int, limit: int) -> Tuple[List[str], List[Tuple]]:
        """批量读取数据"""
        return self.columns, self.data[offset:offset + limit]


class JSONSource(DataSource):
    """JSON 数据源"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.data = None

    def connect(self):
        """读取 JSON 文件"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)

    def disconnect(self):
        """清理数据"""
        self.data = None

    def get_tables(self) -> List[str]:
        """获取所有表名"""
        if isinstance(self.data, dict):
            return list(self.data.keys())
        return ['data']

    def get_table_count(self, table: str) -> int:
        """获取记录数"""
        if isinstance(self.data, dict):
            return len(self.data.get(table, []))
        return len(self.data) if isinstance(self.data, list) else 0

    def read_table(self, table: str) -> Tuple[List[str], List[Tuple]]:
        """读取数据"""
        if isinstance(self.data, dict):
            records = self.data.get(table, [])
        else:
            records = self.data

        if not records:
            return [], []

        columns = list(records[0].keys())
        rows = [tuple(record.get(col) for col in columns) for record in records]
        return columns, rows

    def read_table_batch(self, table: str, offset: int, limit: int) -> Tuple[List[str], List[Tuple]]:
        """批量读取数据"""
        columns, rows = self.read_table(table)
        return columns, rows[offset:offset + limit]


# ============================================================================
# 目标数据库抽象
# ============================================================================

class DataTarget(ABC):
    """目标数据库抽象基类"""

    @abstractmethod
    def connect(self):
        """连接数据库"""
        pass

    @abstractmethod
    def disconnect(self):
        """断开数据库"""
        pass

    @abstractmethod
    def clear_tables(self, tables: List[str]):
        """清空指定表"""
        pass

    @abstractmethod
    def insert_batch(self, table: str, data_list: List[Dict]) -> Tuple[int, int]:
        """批量插入数据"""
        pass

    @abstractmethod
    def get_existing_ids(self, table: str, id_field: str = 'id') -> Set[str]:
        """获取表中已存在的 ID 集合"""
        pass

    @abstractmethod
    def get_table_count(self, table: str) -> int:
        """获取表的记录数"""
        pass

    @abstractmethod
    def execute_query(self, sql: str, params: Optional[Tuple] = None) -> List[Tuple]:
        """执行查询"""
        pass

    @abstractmethod
    def commit(self):
        """提交事务"""
        pass

    @abstractmethod
    def rollback(self):
        """回滚事务"""
        pass


class SQLiteTarget(DataTarget):
    """SQLite 目标数据库（高性能优化版）"""

    def __init__(self, db_path: str, logger: Logger, dry_run: bool = False,
                 performance_mode: bool = True):
        self.db_path = db_path
        self.logger = logger
        self.dry_run = dry_run
        self.performance_mode = performance_mode
        self.conn = None
        self.cursor = None
        self._lock = threading.Lock()
        self._batch_count = 0
        self._index_definitions = {}

    def connect(self):
        """连接数据库并优化配置"""
        if self.dry_run:
            return

        try:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.cursor = self.conn.cursor()

            # 基础配置
            self.cursor.execute('PRAGMA foreign_keys=OFF')
            self.cursor.execute('PRAGMA journal_mode=WAL')

            if self.performance_mode:
                # 高性能配置
                self.cursor.execute('PRAGMA synchronous=OFF')  # 最快模式
                self.cursor.execute('PRAGMA cache_size=-20000')  # 20MB缓存
                self.cursor.execute('PRAGMA temp_store=MEMORY')  # 内存临时表
                self.cursor.execute('PRAGMA mmap_size=268435456')  # 256MB内存映射
                self.cursor.execute('PRAGMA page_size=4096')  # 优化页大小
                self.logger.debug('已启用高性能模式')
            else:
                # 安全模式
                self.cursor.execute('PRAGMA synchronous=NORMAL')
                self.cursor.execute('PRAGMA cache_size=-10000')

            self.logger.debug(f'已连接到数据库: {self.db_path}')
        except Exception as e:
            self.logger.error(f'连接数据库失败: {e}')
            raise

    def disconnect(self):
        """断开数据库连接"""
        if self.conn:
            try:
                self.conn.close()
                self.logger.debug('已断开数据库连接')
            except Exception as e:
                self.logger.warning(f'断开数据库连接时出错: {e}')

    def clear_tables(self, tables: List[str]):
        """清空指定表"""
        if self.dry_run:
            self.logger.info(f'[DRY RUN] 将清空表: {", ".join(tables)}')
            return

        for table in tables:
            try:
                self.cursor.execute(f'DELETE FROM {table}')
                self.logger.debug(f'已清空表: {table}')
            except Exception as e:
                self.logger.error(f'清空表 {table} 失败: {e}')
                raise

        self.commit()

    def insert_batch(self, table: str, data_list: List[Dict]) -> Tuple[int, int]:
        """高性能批量插入数据"""
        if not data_list:
            return 0, 0

        if self.dry_run:
            return len(data_list), 0

        success_count = 0
        error_count = 0

        with self._lock:
            try:
                # 提取列名（使用第一条记录的keys）
                columns = list(data_list[0].keys())
                cols_str = ', '.join(columns)
                placeholders = ', '.join(['?' for _ in columns])
                sql = f'INSERT OR REPLACE INTO {table} ({cols_str}) VALUES ({placeholders})'

                # 转换为元组列表
                values_list = [tuple(data.get(col) for col in columns) for data in data_list]

                # 使用 executemany 批量插入
                self.cursor.execute('BEGIN')
                self.cursor.executemany(sql, values_list)
                success_count = len(data_list)

                # 定期提交（每5批）
                self._batch_count += 1
                if self._batch_count % 5 == 0:
                    self.conn.commit()

            except Exception as e:
                error_count = len(data_list)
                self.logger.error(f'批量插入 {table} 失败: {e}',
                                {'table': table, 'count': len(data_list), 'error': str(e)})
                try:
                    self.conn.rollback()
                except:
                    pass

        return success_count, error_count

    def disable_indexes(self, tables: List[str]):
        """禁用索引（导入前调用）"""
        if not self.performance_mode or self.dry_run:
            return

        for table in tables:
            try:
                # 保存索引定义
                self.cursor.execute(
                    f"SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='{table}' AND sql IS NOT NULL"
                )
                indexes = self.cursor.fetchall()
                self._index_definitions[table] = [(name, sql) for name, sql in indexes]

                # 删除索引
                for name, _ in indexes:
                    self.cursor.execute(f'DROP INDEX IF EXISTS {name}')
                    self.logger.debug(f'已禁用索引: {name}')

            except Exception as e:
                self.logger.warning(f'禁用 {table} 索引失败: {e}')

    def enable_indexes(self, tables: List[str]):
        """重建索引（导入后调用）"""
        if not self.performance_mode or self.dry_run:
            return

        for table in tables:
            if table in self._index_definitions:
                for name, sql in self._index_definitions[table]:
                    try:
                        self.cursor.execute(sql)
                        self.logger.debug(f'已重建索引: {name}')
                    except Exception as e:
                        self.logger.warning(f'重建索引 {name} 失败: {e}')

    def get_existing_ids(self, table: str, id_field: str = 'id') -> Set[str]:
        """获取表中已存在的 ID 集合"""
        if self.dry_run:
            return set()

        try:
            self.cursor.execute(f'SELECT {id_field} FROM {table}')
            return {row[0] for row in self.cursor.fetchall()}
        except Exception as e:
            self.logger.warning(f'获取 {table} 现有 ID 失败: {e}')
            return set()

    def get_table_count(self, table: str) -> int:
        """获取表的记录数"""
        if self.dry_run:
            return 0

        try:
            self.cursor.execute(f'SELECT COUNT(*) FROM {table}')
            return self.cursor.fetchone()[0]
        except Exception as e:
            self.logger.warning(f'获取 {table} 记录数失败: {e}')
            return 0

    def execute_query(self, sql: str, params: Optional[Tuple] = None) -> List[Tuple]:
        """执行查询"""
        if self.dry_run:
            return []

        try:
            if params:
                self.cursor.execute(sql, params)
            else:
                self.cursor.execute(sql)
            return self.cursor.fetchall()
        except Exception as e:
            self.logger.error(f'执行查询失败: {e}', {'sql': sql[:100]})
            raise

    def commit(self):
        """提交事务"""
        if self.conn and not self.dry_run:
            try:
                self.conn.commit()
            except Exception as e:
                self.logger.error(f'提交事务失败: {e}')
                raise

    def rollback(self):
        """回滚事务"""
        if self.conn and not self.dry_run:
            try:
                self.conn.rollback()
                self.logger.info('已回滚事务')
            except Exception as e:
                self.logger.warning(f'回滚事务时出错: {e}')


# ============================================================================
# 数据导入器基类
# ============================================================================

class DataImporter(ABC):
    """数据导入器基类（高性能优化版）"""

    def __init__(self, config: ImportConfig, logger: Logger):
        self.config = config
        self.logger = logger
        self.validator = Validator(logger)
        self.transformer = FieldTransformer()

        self.source_db = None
        self.target_db = None

        self.uuid_maps: Dict[str, Dict[str, str]] = {}
        self.stats: Dict[str, Dict[str, int]] = {}

        self.checkpoint = CheckpointManager(config.checkpoint_path)

        # 性能优化组件
        self.uuid_cache = UUIDCache(config.uuid_cache_size)
        self.parallel_mapper = ParallelMapper(
            workers=config.parallel_workers,
            threshold=config.parallel_threshold
        )

    @abstractmethod
    def get_default_config(self) -> ImportConfig:
        """获取默认配置"""
        pass

    @abstractmethod
    def get_source_tables(self) -> List[str]:
        """获取源表列表"""
        pass

    @abstractmethod
    def get_target_tables(self) -> List[str]:
        """获取目标表列表"""
        pass

    def run(self):
        """执行导入"""
        start_time = time.time()
        self.logger.info(colorize('📦 开始数据导入...\n', Colors.BOLD))

        try:
            self._connect_databases()

            # 预览模式
            if self.config.preview:
                self._preview_data()
                return

            # 统计模式
            if self.config.stats:
                self._show_stats()
                return

            # 回滚模式
            if self.config.rollback:
                self._rollback()
                return

            self._log_source_stats()

            if self.config.export_path:
                self._export_data()
                return

            if not self.config.dry_run and self.config.clear_target:
                self._clear_target_tables()

            for mapping in self.config.table_mappings:
                self._import_table(mapping)

            if not self.config.dry_run:
                self._validate_results()

            if self.config.checkpoint_path:
                self.checkpoint.clear()

            self._generate_report(start_time)

        except KeyboardInterrupt:
            self.logger.warning('\n\n⚠️  用户中断，正在保存检查点...')
            self._save_checkpoint_on_interrupt()
            raise
        except Exception as e:
            self.logger.error(f'导入过程中发生错误: {e}')
            if self.target_db:
                self.target_db.rollback()
            raise
        finally:
            self._disconnect_databases()

    def _connect_databases(self):
        """连接数据库（高性能模式）"""
        self.logger.info(colorize('🔌 连接数据库...', Colors.CYAN))

        try:
            self.source_db = sqlite3.connect(self.config.source_path)
            self.logger.debug(f'已连接到源数据库: {self.config.source_path}')
        except Exception as e:
            self.logger.error(f'连接源数据库失败: {e}')
            raise

        try:
            # 使用高性能数据库操作器
            self.target_db = SQLiteTarget(
                self.config.target_path,
                self.logger,
                self.config.dry_run,
                performance_mode=self.config.performance_mode
            )
            if not self.config.dry_run:
                self.target_db.connect()

            if self.config.performance_mode:
                self.logger.info(colorize('   ⚡ 已启用高性能模式', Colors.YELLOW))
        except Exception as e:
            self.logger.error(f'连接目标数据库失败: {e}')
            raise

    def _disconnect_databases(self):
        """断开数据库连接"""
        if self.source_db:
            self.source_db.close()
        if self.target_db:
            self.target_db.disconnect()

    def _log_source_stats(self):
        """记录源数据统计"""
        cursor = self.source_db.cursor()

        self.logger.info(colorize('📊 源数据库统计:', Colors.BOLD))
        for table in self.get_source_tables():
            try:
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                count = cursor.fetchone()[0]
                self.logger.info(f'   - {table}: {colorize(str(count), Colors.CYAN)} 条')
            except Exception as e:
                self.logger.warning(f'获取 {table} 统计失败: {e}')
        self.logger.info('')

    def _clear_target_tables(self):
        """清空目标表"""
        self.logger.info(colorize('🗑️  清空目标表...', Colors.YELLOW))
        tables = self.get_target_tables()
        self.target_db.clear_tables(tables)
        for table in tables:
            self.logger.success(f'清空 {table}')
        self.logger.info('')

    def _preview_data(self):
        """预览数据"""
        self.logger.info(colorize('\n👀 数据预览:', Colors.BOLD))

        cursor = self.source_db.cursor()

        for table in self.get_source_tables():
            try:
                cursor.execute(f'SELECT * FROM {table} LIMIT 10')
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()

                self.logger.info(f'\n   📋 {table} (前 10 条):')
                self.logger.info(f'   列: {", ".join(columns)}')
                self.logger.info(f'   {"─" * 80}')

                for i, row in enumerate(rows):
                    self.logger.info(f'   {i+1:2d}. {row}')

                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                total = cursor.fetchone()[0]
                self.logger.info(f'   {"─" * 80}')
                self.logger.info(f'   共 {total} 条记录')

            except Exception as e:
                self.logger.error(f'预览 {table} 失败: {e}')

    def _show_stats(self):
        """显示数据统计"""
        self.logger.info(colorize('\n📊 数据统计:', Colors.BOLD))

        cursor = self.source_db.cursor()

        for table in self.get_source_tables():
            try:
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                count = cursor.fetchone()[0]
                self.logger.info(f'   - {table}: {colorize(str(count), Colors.CYAN)} 条')

                # 显示列信息
                cursor.execute(f'PRAGMA table_info({table})')
                columns = cursor.fetchall()
                self.logger.info(f'     列: {", ".join([col[1] for col in columns])}')

            except Exception as e:
                self.logger.error(f'获取 {table} 统计失败: {e}')

    def _rollback(self):
        """回滚上一次导入"""
        self.logger.info(colorize('\n⏪ 回滚上一次导入...', Colors.YELLOW))

        if not self.config.dry_run:
            tables = self.get_target_tables()
            self.target_db.clear_tables(tables)
            for table in tables:
                self.logger.success(f'已清空 {table}')

            self.target_db.commit()
            self.logger.success('回滚完成')
        else:
            self.logger.info('[DRY RUN] 将清空目标表')

    def _import_table(self, mapping: TableMapping):
        """导入单个表（高性能优化版）"""
        self.logger.info(colorize(f'\n🔄 处理 {mapping.source_table} → {mapping.target_table}...', Colors.BOLD))

        if self.checkpoint.is_completed(mapping.target_table):
            self.logger.info('   ⏭️  跳过（已完成）')
            return

        self.checkpoint.save(mapping.target_table)

        # 记录开始时间
        start_time = time.time()

        # 禁用索引（导入前）
        if hasattr(self.target_db, 'disable_indexes'):
            self.target_db.disable_indexes([mapping.target_table])

        cursor = self.source_db.cursor()
        try:
            cursor.execute(f'SELECT * FROM {mapping.source_table}')
            source_columns = [description[0] for description in cursor.description]
            source_rows = cursor.fetchall()
        except Exception as e:
            self.logger.error(f'读取源表 {mapping.source_table} 失败: {e}')
            return

        if self.config.incremental and not self.config.dry_run:
            existing_ids = self.target_db.get_existing_ids(mapping.target_table)
            original_count = len(source_rows)
            source_rows = [r for r in source_rows if self._get_record_uuid(r, source_columns, mapping) not in existing_ids]
            skipped = original_count - len(source_rows)
            if skipped > 0:
                self.logger.info(f'   📋 增量模式：跳过 {skipped} 条已存在的记录')

        mapped_records = []
        stats = {'success': 0, 'failed': 0, 'warnings': 0}
        progress = ProgressBar(len(source_rows), f'映射 {mapping.source_table}')

        for row in source_rows:
            try:
                mapped = self._map_record(row, source_columns, mapping, stats)
                if mapped:
                    mapped_records.append(mapped)
            except Exception as e:
                self.logger.error(f'映射记录失败: {e}')
                stats['failed'] += 1
            progress.update()

        progress.finish()

        # 批量写入
        if not self.config.validate_only and mapped_records:
            self.logger.info('   💾 写入数据库...')
            success, errors = self.target_db.insert_batch(mapping.target_table, mapped_records)
            self.logger.success(f'{success}/{len(source_rows)} 条记录成功')
            if errors > 0:
                self.logger.error(f'{errors} 条记录失败')

        # 重建索引（导入后）
        if hasattr(self.target_db, 'enable_indexes'):
            self.target_db.enable_indexes([mapping.target_table])

        # 提交
        if not self.config.dry_run:
            self.target_db.commit()

        # 计算性能
        elapsed = time.time() - start_time
        speed = len(source_rows) / elapsed if elapsed > 0 else 0

        self.logger.info(f'   ⏱️  耗时: {elapsed:.2f}s, 速度: {speed:.0f} 条/秒')

        self.stats[mapping.target_table] = stats
        self.checkpoint.mark_completed(mapping.target_table)

    def _get_record_uuid(self, row: Tuple, columns: List[str], mapping: TableMapping) -> str:
        """获取记录的 UUID"""
        for field in ['id', 'product_id', 'variant_id', 'image_id']:
            if field in columns:
                idx = columns.index(field)
                source_id = row[idx]
                return generate_uuid(f'{self.config.uuid_prefix}-{mapping.source_table}-{source_id}')

        return generate_uuid(f'{self.config.uuid_prefix}-{mapping.source_table}-{row[0]}')

    def _map_record(self, row: Tuple, columns: List[str], mapping: TableMapping, stats: Dict) -> Optional[Dict]:
        """映射单条记录"""
        source_data = dict(zip(columns, row))
        target_data = {}

        for target_field, source_field in mapping.field_mappings.items():
            if source_field in source_data:
                value = source_data[source_field]
            elif source_field.startswith('$'):
                constant_value = source_field[1:]
                if constant_value.lower() == 'null':
                    value = None
                else:
                    value = constant_value
            else:
                value = None

            if target_field in mapping.transformations:
                transform_type = mapping.transformations[target_field]
                kwargs = {'prefix': self.config.uuid_prefix}

                if transform_type == 'uuid':
                    if target_field == 'product_id':
                        kwargs['seed'] = f'products-id-{value}'
                    elif target_field == 'variant_id':
                        kwargs['seed'] = f'product_variants-id-{value}'
                    elif target_field == 'image_id':
                        kwargs['seed'] = f'files-id-{value}'
                    else:
                        kwargs['seed'] = f'{mapping.target_table}-{target_field}-{value}'
                elif transform_type == 'slug':
                    kwargs['fallback_id'] = str(source_data.get('product_id', source_data.get('id', 'unknown')))

                value = self.transformer.transform(value, transform_type, **kwargs)

            if value is None and target_field in mapping.default_values:
                value = mapping.default_values[target_field]

            target_data[target_field] = value

        is_valid, errors = self.validator.validate_record(target_data, mapping)
        if not is_valid:
            self.logger.warning(f'记录验证失败: {", ".join(errors)}',
                               {'source_id': source_data.get('id'), 'errors': errors})
            stats['warnings'] += 1

        stats['success'] += 1
        return target_data

    def _validate_results(self):
        """验证导入结果"""
        self.logger.info(colorize('\n📊 验证导入结果:', Colors.BOLD))

        for mapping in self.config.table_mappings:
            try:
                count = self.target_db.get_table_count(mapping.target_table)
                self.logger.info(f'   - {mapping.target_table}: {colorize(str(count), Colors.CYAN)} 条')
            except Exception as e:
                self.logger.error(f'验证 {mapping.target_table} 失败: {e}')

    def _export_data(self):
        """导出数据到 JSON 文件"""
        self.logger.info(colorize(f'\n📤 导出数据到: {self.config.export_path}', Colors.CYAN))

        cursor = self.source_db.cursor()

        export_data = {
            'export_time': datetime.now().isoformat(),
            'source': self.config.source_path,
            'tables': {}
        }

        for table in self.get_source_tables():
            try:
                cursor.execute(f'SELECT * FROM {table}')
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()

                export_data['tables'][table] = {
                    'columns': columns,
                    'data': rows
                }

                self.logger.info(f'   - {table}: {len(rows)} 条')
            except Exception as e:
                self.logger.warning(f'导出 {table} 失败: {e}')

        try:
            with open(self.config.export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)
            self.logger.success('导出完成')
        except Exception as e:
            self.logger.error(f'导出失败: {e}')
            raise

    def _save_checkpoint_on_interrupt(self):
        """中断时保存检查点"""
        if self.config.checkpoint_path:
            self.checkpoint.save(
                table=self.checkpoint.data.get('last_table', 'unknown'),
                stats=self.stats
            )
            self.logger.info(f'检查点已保存到: {self.config.checkpoint_path}')

    def _generate_report(self, start_time: float):
        """生成导入报告"""
        duration = time.time() - start_time

        self.logger.info(colorize('\n✨ 导入完成！', Colors.GREEN + Colors.BOLD))
        self.logger.info(f'⏱️  耗时: {colorize(f"{duration:.2f} 秒", Colors.CYAN)}')

        stats = self.stats
        self.logger.info(colorize('\n📈 映射统计:', Colors.BOLD))
        for table, stat in stats.items():
            self.logger.info(f'   {table}:')
            self.logger.info(f'     - 成功: {colorize(str(stat["success"]), Colors.GREEN)}')
            self.logger.info(f'     - 失败: {colorize(str(stat["failed"]), Colors.RED if stat["failed"] > 0 else Colors.GREEN)}')
            self.logger.info(f'     - 警告: {colorize(str(stat["warnings"]), Colors.YELLOW if stat["warnings"] > 0 else Colors.GREEN)}')

        log_summary = self.logger.get_summary()
        if log_summary['errors'] > 0 or log_summary['warnings'] > 0:
            self.logger.info(colorize('\n📝 日志摘要:', Colors.BOLD))
            self.logger.info(f'   - 错误: {colorize(str(log_summary["errors"]), Colors.RED if log_summary["errors"] > 0 else Colors.GREEN)}')
            self.logger.info(f'   - 警告: {colorize(str(log_summary["warnings"]), Colors.YELLOW if log_summary["warnings"] > 0 else Colors.GREEN)}')

            if self.config.log_file:
                self._save_detailed_report(log_summary, duration)

    def _save_detailed_report(self, log_summary: Dict, duration: float):
        """保存详细报告"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': duration,
            'config': {
                'source_path': self.config.source_path,
                'target_path': self.config.target_path,
                'dry_run': self.config.dry_run,
                'incremental': self.config.incremental,
                'sync_mode': self.config.sync_mode,
            },
            'stats': self.stats,
            'log_summary': log_summary,
        }

        report_file = self.config.log_file.replace('.log', '-report.json')
        try:
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            self.logger.info(f'   - 详细报告已保存到: {report_file}')
        except Exception as e:
            self.logger.warning(f'保存详细报告失败: {e}')


# ============================================================================
# Lali 数据导入器
# ============================================================================

class LaliImporter(DataImporter):
    """Lali 数据导入器"""

    def get_default_config(self) -> ImportConfig:
        """获取默认配置"""
        config = ImportConfig()
        config.source_path = os.path.join(os.getcwd(), 'lali.db')
        config.target_path = self._find_d1_db()
        config.uuid_prefix = 'lali'

        config.table_mappings.append(TableMapping(
            source_table='products',
            target_table='products',
            field_mappings={
                'id': 'product_id',
                'name': 'title',
                'spu': 'sku',
                'product_code': 'sku',
                'slug': 'url',
                'category': 'product_type',
                'brand': 'source',
                'series': '$null',
                'description': 'description',
                'images': '$[]',
                'specifications': 'extra',
                'options': '$[]',
                'created_at': 'scraped_at',
                'updated_at': 'published_at',
                'currency': '$CNY',
            },
            transformations={
                'id': 'uuid',
                'slug': 'slug',
                'description': 'html',
                'specifications': 'json',
                'created_at': 'timestamp',
                'updated_at': 'timestamp',
            },
            default_values={
                'name': 'Untitled',
                'images': '[]',
                'options': '[]',
                'currency': 'CNY',
            },
            required_fields=['id', 'name', 'created_at', 'updated_at'],
            unique_fields=['id', 'spu', 'slug'],
        ))

        config.table_mappings.append(TableMapping(
            source_table='variants',
            target_table='product_variants',
            field_mappings={
                'id': 'variant_id',
                'product_id': 'product_id',
                'sku': 'sku',
                'price': 'price',
                'cost_price': 'compare_at_price',
                'stock_quantity': 'available',
                'options_values': 'attributes',
                'image_id': '$null',
                'status': 'available',
                'created_at': '$now',
                'updated_at': '$now',
                'variant_code': 'sku',
                'alert_threshold': '$10',
                'moq': '$1',
                'pack_size': '$1',
                'order_step': '$1',
                'suggested_purchase_price': 'price',
                'barcode': 'barcode',
                'supplier_sku': '$null',
                'variant_signature': '$null',
            },
            transformations={
                'id': 'uuid',
                'product_id': 'uuid',
                'price': 'float',
                'cost_price': 'float',
                'stock_quantity': 'stock',
                'options_values': 'json',
                'status': 'status',
                'created_at': 'timestamp',
                'updated_at': 'timestamp',
                'suggested_purchase_price': 'suggested_price',
            },
            default_values={
                'sku': 'SKU-unknown',
                'status': 'archived',
                'stock_quantity': 0,
                'options_values': '{}',
                'alert_threshold': 10,
                'moq': 1,
                'pack_size': 1,
                'order_step': 1,
                'suggested_purchase_price': 0,
            },
            required_fields=['id', 'product_id', 'sku', 'created_at', 'updated_at'],
            unique_fields=['id', 'sku'],
        ))

        config.table_mappings.append(TableMapping(
            source_table='images',
            target_table='files',
            field_mappings={
                'id': 'image_id',
                'folder_id': '$null',
                'name': 'src',
                'original_name': 'src',
                'size': '$0',
                'mime_type': 'src',
                'storage_key': 'src',
                'created_at': '$now',
                'is_public': '$1',
                'created_by': '$null',
                'updated_at': '$now',
                'width': 'width',
                'height': 'height',
                'blurhash': '$null',
                'content_hash': '$null',
                'original_hash': '$null',
                'status': '$normal',
                'is_deleted': '$0',
                'deleted_at': '$null',
            },
            transformations={
                'id': 'uuid',
                'name': 'file_name',
                'original_name': 'file_name',
                'mime_type': 'mime_type',
                'created_at': 'timestamp',
                'updated_at': 'timestamp',
                'width': 'int',
                'height': 'int',
            },
            default_values={
                'name': 'unknown.jpg',
                'original_name': 'unknown.jpg',
                'mime_type': 'image/jpeg',
                'storage_key': 'images/unknown.jpg',
                'is_public': 1,
                'status': 'normal',
                'is_deleted': 0,
            },
            required_fields=['id', 'name', 'storage_key', 'created_at'],
            unique_fields=['id'],
        ))

        return config

    def get_source_tables(self) -> List[str]:
        """获取源表列表"""
        return ['products', 'variants', 'images']

    def get_target_tables(self) -> List[str]:
        """获取目标表列表"""
        return ['files', 'products', 'product_variants']

    def _find_d1_db(self) -> str:
        """查找本地 D1 数据库文件"""
        d1_dir = os.path.join(os.getcwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
        if not os.path.exists(d1_dir):
            raise FileNotFoundError(f'D1 目录不存在: {d1_dir}')

        for f in os.listdir(d1_dir):
            if f.endswith('.sqlite'):
                return os.path.join(d1_dir, f)

        raise FileNotFoundError(f'在 {d1_dir} 中未找到 .sqlite 文件')

    def _map_record(self, row: Tuple, columns: List[str], mapping: TableMapping, stats: Dict) -> Optional[Dict]:
        """映射单条记录（Lali 特化）"""
        source_data = dict(zip(columns, row))

        if mapping.source_table == 'products':
            cursor = self.source_db.cursor()
            cursor.execute('SELECT src FROM images WHERE product_id = ? ORDER BY position',
                          (source_data.get('product_id'),))
            image_urls = [row[0] for row in cursor.fetchall() if row[0]]
            source_data['_images'] = image_urls

        return super()._map_record(row, columns, mapping, stats)


# ============================================================================
# 主函数
# ============================================================================

def main():
    """主函数"""
    args = sys.argv[1:]

    config_file = None
    for arg in args:
        if arg.startswith('--config='):
            config_file = arg.split('=', 1)[1]
            break

    if config_file:
        config = ImportConfig.from_file(config_file)
    else:
        config = ImportConfig.from_args(args)

    if not config.source_path:
        config.source_path = os.path.join(os.getcwd(), 'lali.db')
    if not config.target_path:
        d1_dir = os.path.join(os.getcwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
        if os.path.exists(d1_dir):
            for f in os.listdir(d1_dir):
                if f.endswith('.sqlite'):
                    config.target_path = os.path.join(d1_dir, f)
                    break

    logger = Logger(log_file=config.log_file, verbose=config.verbose)

    if not config.table_mappings:
        temp_importer = LaliImporter(config, logger)
        default_config = temp_importer.get_default_config()

        if not config.source_path or config.source_path == os.path.join(os.getcwd(), 'lali.db'):
            config.source_path = default_config.source_path
        if not config.target_path:
            config.target_path = default_config.target_path
        if not config.uuid_prefix or config.uuid_prefix == 'import':
            config.uuid_prefix = default_config.uuid_prefix
        if not config.table_mappings:
            config.table_mappings = default_config.table_mappings

        importer = LaliImporter(config, logger)
    else:
        class GenericImporter(DataImporter):
            def get_default_config(self) -> ImportConfig:
                return config

            def get_source_tables(self) -> List[str]:
                return [m.source_table for m in self.config.table_mappings]

            def get_target_tables(self) -> List[str]:
                return [m.target_table for m in self.config.table_mappings]

        importer = GenericImporter(config, logger)

    try:
        importer.run()
    except KeyboardInterrupt:
        print('\n\n⚠️  用户中断，导入已取消')
        sys.exit(1)
    except Exception as e:
        print(f'\n\n❌ 导入失败: {e}')
        if config.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
