#!/usr/bin/env python3
"""
文件大小审计脚本
================
扫描项目中的源代码文件，识别需要拆分的大文件。

阈值:
- 警告级 (Warning): 300 行
- 危险级 (Critical): 500 行
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

# 配置
WARNING_THRESHOLD = 300
CRITICAL_THRESHOLD = 500

# 扫描目录
SCAN_DIRS = ['src', 'functions']

# 扫描的文件扩展名
EXTENSIONS = {'.js', '.ts', '.vue', '.jsx', '.tsx'}

# 排除目录
EXCLUDE_DIRS = {'node_modules', 'dist', '.git', '__pycache__', 'coverage'}

# 排除文件 (basename)
EXCLUDE_FILES = {'vendor.js', 'bundle.js'}


def count_lines(file_path: Path) -> int:
    """统计文件行数（忽略空行和纯注释行）"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        # 统计非空行（简单统计，不做复杂的注释剔除）
        total = len([line for line in lines if line.strip()])
        return total
    except Exception as e:
        print(f"  ⚠️ 无法读取文件: {file_path} ({e})")
        return 0


def scan_directory(base_path: Path) -> list:
    """扫描目录，返回文件信息列表"""
    results = []
    
    for root, dirs, files in os.walk(base_path):
        # 过滤排除目录
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            file_path = Path(root) / file
            
            # 检查扩展名
            if file_path.suffix not in EXTENSIONS:
                continue
            
            # 检查排除文件
            if file_path.name in EXCLUDE_FILES:
                continue
            
            line_count = count_lines(file_path)
            
            if line_count > 0:
                results.append({
                    'path': file_path,
                    'lines': line_count,
                    'relative': file_path.relative_to(base_path.parent) if base_path.parent != file_path else file_path.name
                })
    
    return results


def categorize_by_type(file_path: Path) -> str:
    """根据路径和扩展名分类文件"""
    path_str = str(file_path)
    
    if 'components' in path_str:
        return 'Vue 组件'
    elif 'composables' in path_str:
        return 'Composable'
    elif 'views' in path_str or 'pages' in path_str:
        return '页面'
    elif 'repositories' in path_str:
        return 'Repository'
    elif 'routes' in path_str:
        return '路由处理'
    elif 'utils' in path_str or 'shared' in path_str:
        return '工具函数'
    elif 'api' in path_str:
        return 'API 端点'
    elif file_path.suffix == '.vue':
        return 'Vue 组件'
    else:
        return '其他'


def print_report(results: list, project_root: Path):
    """打印审计报告"""
    # 按行数排序
    sorted_results = sorted(results, key=lambda x: x['lines'], reverse=True)
    
    critical = [r for r in sorted_results if r['lines'] >= CRITICAL_THRESHOLD]
    warning = [r for r in sorted_results if WARNING_THRESHOLD <= r['lines'] < CRITICAL_THRESHOLD]
    
    print("\n" + "=" * 70)
    print("📊 文件大小审计报告")
    print("=" * 70)
    print(f"扫描目录: {', '.join(SCAN_DIRS)}")
    print(f"警告阈值: {WARNING_THRESHOLD} 行 | 危险阈值: {CRITICAL_THRESHOLD} 行")
    print(f"扫描文件数: {len(results)}")
    print("=" * 70)
    
    # 危险级文件
    if critical:
        print(f"\n🔴 危险级 (≥{CRITICAL_THRESHOLD} 行) - 强烈建议拆分: {len(critical)} 个")
        print("-" * 70)
        for r in critical:
            category = categorize_by_type(r['path'])
            rel_path = r['path'].relative_to(project_root)
            print(f"  {r['lines']:>4} 行 | [{category}] {rel_path}")
    else:
        print(f"\n✅ 没有危险级文件 (≥{CRITICAL_THRESHOLD} 行)")
    
    # 警告级文件
    if warning:
        print(f"\n🟡 警告级 ({WARNING_THRESHOLD}-{CRITICAL_THRESHOLD-1} 行) - 考虑拆分: {len(warning)} 个")
        print("-" * 70)
        for r in warning:
            category = categorize_by_type(r['path'])
            rel_path = r['path'].relative_to(project_root)
            print(f"  {r['lines']:>4} 行 | [{category}] {rel_path}")
    else:
        print(f"\n✅ 没有警告级文件 ({WARNING_THRESHOLD}-{CRITICAL_THRESHOLD-1} 行)")
    
    # 分类统计
    print("\n📈 按类型统计 (Top 10 最大文件)")
    print("-" * 70)
    by_category = defaultdict(list)
    for r in sorted_results[:20]:
        cat = categorize_by_type(r['path'])
        by_category[cat].append(r)
    
    for cat, files in sorted(by_category.items(), key=lambda x: max(f['lines'] for f in x[1]), reverse=True):
        max_lines = max(f['lines'] for f in files)
        avg_lines = sum(f['lines'] for f in files) // len(files)
        print(f"  {cat}: 最大 {max_lines} 行, 平均 {avg_lines} 行, 共 {len(files)} 个")
    
    # 总结
    print("\n" + "=" * 70)
    total_critical = len(critical)
    total_warning = len(warning)
    
    if total_critical == 0 and total_warning == 0:
        print("🎉 代码库健康！没有需要拆分的文件。")
    elif total_critical == 0:
        print(f"⚠️ 有 {total_warning} 个文件处于警告级，建议逐步优化。")
    else:
        print(f"❗ 有 {total_critical} 个危险级文件需要优先处理！")
        print("   建议: 使用 Repository 模式或拆分为子模块。")
    
    print("=" * 70 + "\n")


def main():
    # 确定项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent if script_dir.name == 'scripts' else script_dir
    
    # 检查扫描目录是否存在
    existing_dirs = []
    for d in SCAN_DIRS:
        dir_path = project_root / d
        if dir_path.exists():
            existing_dirs.append(dir_path)
        else:
            print(f"⚠️ 目录不存在，跳过: {d}")
    
    if not existing_dirs:
        print("❌ 没有找到可扫描的目录！")
        sys.exit(1)
    
    # 扫描所有目录
    all_results = []
    for dir_path in existing_dirs:
        print(f"🔍 扫描中: {dir_path.name}/")
        results = scan_directory(dir_path)
        all_results.extend(results)
    
    # 打印报告
    print_report(all_results, project_root)


if __name__ == '__main__':
    main()
