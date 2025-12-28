#!/usr/bin/env python3
"""
硬编码中文字符串扫描器
扫描 Vue/JS 文件中的硬编码中文字符串，排除翻译文件和其他无需检查的文件
"""

import os
import re
from pathlib import Path

# 项目根目录
PROJECT_ROOT = "/Users/kayla/Downloads/Code/KK-Image"

# 要扫描的目录
SCAN_DIRS = ["src", "functions"]

# 排除的文件/目录模式
EXCLUDE_PATTERNS = [
    "locales",           # 翻译文件
    "node_modules",      # 依赖
    ".git",              # Git
    "dist",              # 构建输出
    "test",              # 测试文件
    ".md",               # Markdown
    ".json",             # JSON 配置
    ".css",              # 样式文件
    ".scss",
]

# 要扫描的文件扩展名
INCLUDE_EXTENSIONS = [".vue", ".js", ".ts", ".jsx", ".tsx"]

# 中文字符正则（包含中文标点）
CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]')

# 字符串提取正则（单引号或双引号）
STRING_PATTERN = re.compile(r'''
    (?:
        '([^'\\]*(?:\\.[^'\\]*)*)'  # 单引号字符串
        |
        "([^"\\]*(?:\\.[^"\\]*)*)"  # 双引号字符串
        |
        `([^`\\]*(?:\\.[^`\\]*)*)`  # 模板字符串
    )
''', re.VERBOSE)

def should_exclude(path: str) -> bool:
    """检查路径是否应该被排除"""
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path:
            return True
    return False

def extract_strings_with_chinese(content: str, file_path: str) -> list:
    """从文件内容中提取包含中文的字符串"""
    results = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        # 跳过注释行
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        
        # 跳过 import 语句
        if 'import ' in line or 'require(' in line:
            continue
        
        # 跳过 t() 调用（已国际化）
        if "t('" in line or 't("' in line or "t(`" in line:
            continue
        
        # 查找所有字符串
        for match in STRING_PATTERN.finditer(line):
            string_content = match.group(1) or match.group(2) or match.group(3)
            if string_content and CHINESE_PATTERN.search(string_content):
                # 额外过滤：跳过翻译键定义（如 xxx: '中文'）
                if re.match(r'^\s*\w+:\s*[\'"`]', line) and '/locales/' in file_path:
                    continue
                # 跳过纯注释中的中文
                if line.strip().startswith('<!--') or line.strip().startswith('//'):
                    continue
                    
                results.append({
                    'file': file_path,
                    'line': line_num,
                    'string': string_content[:50] + ('...' if len(string_content) > 50 else ''),
                    'context': line.strip()[:80]
                })
    
    return results

def scan_directory(root_dir: str) -> list:
    """扫描目录中的所有文件"""
    all_results = []
    
    for scan_dir in SCAN_DIRS:
        full_path = os.path.join(root_dir, scan_dir)
        if not os.path.exists(full_path):
            continue
            
        for dirpath, dirnames, filenames in os.walk(full_path):
            # 排除目录
            dirnames[:] = [d for d in dirnames if not should_exclude(d)]
            
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                
                # 检查扩展名
                if not any(filename.endswith(ext) for ext in INCLUDE_EXTENSIONS):
                    continue
                
                # 检查排除模式
                if should_exclude(file_path):
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    results = extract_strings_with_chinese(content, file_path)
                    all_results.extend(results)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
    
    return all_results

def main():
    print("=" * 60)
    print("硬编码中文字符串扫描器")
    print("=" * 60)
    print(f"扫描目录: {SCAN_DIRS}")
    print(f"排除模式: {EXCLUDE_PATTERNS}")
    print("=" * 60 + "\n")
    
    results = scan_directory(PROJECT_ROOT)
    
    if not results:
        print("✅ 未发现硬编码中文字符串！")
        return
    
    # 按文件分组
    by_file = {}
    for r in results:
        if r['file'] not in by_file:
            by_file[r['file']] = []
        by_file[r['file']].append(r)
    
    print(f"发现 {len(results)} 处可能的硬编码:\n")
    
    for file_path, items in sorted(by_file.items()):
        rel_path = file_path.replace(PROJECT_ROOT + '/', '')
        print(f"📄 {rel_path} ({len(items)} 处)")
        for item in items:
            print(f"   L{item['line']:>4}: {item['string']}")
        print()
    
    print("=" * 60)
    print(f"总计: {len(by_file)} 个文件, {len(results)} 处硬编码")
    print("=" * 60)

if __name__ == "__main__":
    main()
