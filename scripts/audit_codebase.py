import os
import re

# Configuration
SOURCE_DIR = "src"
FUNCTIONS_DIR = "functions"
IGNORE_DIRS = ["node_modules", ".git", "dist", "assets", "locales"]
IGNORE_FILES = ["zh-CN.js", "en-US.js", "audit_codebase.py"]

# Files where hardcoded API paths are expected (route definitions)
BACKEND_ROUTE_FILES = ["app.js", "auth.js", "health.js"]

# Safe SQL patterns (dynamic table/column names with bound values)
SAFE_SQL_PATTERNS = ["batch.js"]

# Regex Patterns
REGEX_API_PATH = re.compile(r"['\"]/api/v\d+/.*?['\"]|['\"]/api/manage/.*?['\"]|['\"]/api/sales/.*?['\"]")
REGEX_CHINESE = re.compile(r"[\u4e00-\u9fa5]+")
REGEX_SQL_INTERPOLATION = re.compile(r"prepare\s*\(\s*`[^`]*\$\{.*?\}[^`]*`\s*\)")

# Hardcoded color patterns (skip CSS variables and Tailwind)
REGEX_HEX_COLOR = re.compile(r"['\"]#[0-9A-Fa-f]{3,8}['\"]")
REGEX_RGB_COLOR = re.compile(r"rgba?\s*\(\s*\d+")
REGEX_HSL_COLOR = re.compile(r"hsla?\s*\(\s*\d+")

# Known Utility Function Names to check for local re-definition
COMMON_UTILS = ["formatTime", "formatDate", "formatSize", "formatCurrency", "getStatusStyle", "getStatusText"]

def is_comment_line(line):
    """Check if line is a comment (JS/JSDoc/HTML)"""
    stripped = line.strip()
    return (
        stripped.startswith("//") or
        stripped.startswith("/*") or
        stripped.startswith("*") or
        stripped.startswith("<!--") or
        stripped.endswith("-->") or
        stripped.startswith("@") or  # JSDoc tags
        "* @" in stripped  # JSDoc param lines
    )

def is_style_block(line):
    """Check if inside style-related context"""
    return "<style" in line or "</style" in line or "index.css" in line

def scan_file(filepath):
    issues = []
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            lines = f.readlines()
        except UnicodeDecodeError:
            return []

    in_style_block = False
    in_comment_block = False

    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Track multi-line comments
        if "/*" in line and "*/" not in line:
            in_comment_block = True
        if "*/" in line:
            in_comment_block = False
            continue
        if in_comment_block:
            continue
            
        # Track style blocks
        if "<style" in line:
            in_style_block = True
        if "</style>" in line:
            in_style_block = False
            continue

        # Skip comment lines
        if is_comment_line(line):
            continue

        # 1. Check for Hardcoded API Paths (excluding constants and backend route definitions)
        filename = os.path.basename(filepath)
        if "export const" not in line and "API." not in line and "constants.js" not in filepath:
            if filename not in BACKEND_ROUTE_FILES:
                matches = REGEX_API_PATH.findall(line)
                for match in matches:
                    issues.append(f"[Hardcoded API] Line {line_num}: {match}")

        # 2. Check for Hardcoded Chinese Strings (only in frontend, non-comments)
        if "functions/" not in filepath and not in_style_block:
            code_part = line.split("//")[0]  # Remove inline comments
            matches = REGEX_CHINESE.findall(code_part)
            if matches:
                # Skip known safe patterns
                if any(skip in line for skip in ["console.log", "throw new Error", "t(", "placeholder=", ":placeholder"]):
                    continue
                issues.append(f"[Hardcoded String] Line {line_num}: {matches}")

        # 3. Check for SQL Injection risks (skip safe dynamic SQL files and patterns)
        if "functions/" in filepath:
            filename = os.path.basename(filepath)
            if filename not in SAFE_SQL_PATTERNS:
                if REGEX_SQL_INTERPOLATION.search(line):
                    # Safe pattern: dynamic UPDATE with .bind() for values
                    if ".bind(" in line and ("updates.join" in line or "setClause" in line):
                        continue  # Safe dynamic UPDATE pattern
                    issues.append(f"[Potential SQL Injection] Line {line_num}: SQL string interpolation detected")

        # 4. Check for Common Utils local definition (skip if it's just an alias wrapper)
        for util in COMMON_UTILS:
            if f"const {util} =" in line or f"function {util}(" in line:
                if "utils/" not in filepath:
                    # Skip if it's just a wrapper calling the central util
                    if "=>" in line and ("format" in line.lower() or "get" in line.lower()):
                        # Likely a wrapper like: const formatTime = (ts) => formatRelativeTime(ts, t)
                        continue
                    issues.append(f"[Duplicate Utility] Line {line_num}: '{util}' defined locally. Should use common utility.")

        # 5. Check for console.log in production code (not in scripts)
        if "console.log" in line and "scripts/" not in filepath:
            # Skip commented console.log
            if not line.strip().startswith("//"):
                issues.append(f"[Console Log] Line {line_num}: console.log usage detected")

        # 6. Check for TODO comments
        if "TODO" in line and not line.strip().startswith("//"):
            issues.append(f"[TODO] Line {line_num}: Pending task found")

        # 7. Check for hardcoded colors in JS/Vue (not in CSS/style blocks)
        if not in_style_block and filepath.endswith(('.vue', '.js', '.jsx', '.ts', '.tsx')):
            # Skip Tailwind classes and CSS variables
            if "var(--" not in line and "tailwind" not in line.lower():
                # Check hex colors in inline styles or JS
                if "style=" in line or "style:" in line or "color:" in line or "background" in line:
                    hex_matches = REGEX_HEX_COLOR.findall(line)
                    if hex_matches:
                        issues.append(f"[Hardcoded Color] Line {line_num}: Hex color {hex_matches} should use CSS variable")
                    rgb_matches = REGEX_RGB_COLOR.findall(line)
                    if rgb_matches:
                        issues.append(f"[Hardcoded Color] Line {line_num}: RGB color detected, consider CSS variable")

    return issues

def main():
    report = {}
    
    # Scan src directory
    for root, dirs, files in os.walk(SOURCE_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            if file in IGNORE_FILES: continue
            if not file.endswith(('.vue', '.js', '.ts', '.jsx', '.tsx')): continue
            
            filepath = os.path.join(root, file)
            issues = scan_file(filepath)
            if issues:
                report[filepath] = issues

    # Scan functions directory
    for root, dirs, files in os.walk(FUNCTIONS_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            if not file.endswith(('.js', '.ts')): continue
            
            filepath = os.path.join(root, file)
            issues = scan_file(filepath)
            if issues:
                report[filepath] = issues

    # Print Report
    if not report:
        print("✅ No issues found! Codebase looks clean.")
    else:
        total_issues = sum(len(issues) for issues in report.values())
        print(f"⚠️  Found {total_issues} issues in {len(report)} files:\n")
        for filepath, issues in sorted(report.items()):
            print(f"📄 {filepath}")
            for issue in issues:
                print(f"   └─ {issue}")
            print("")

if __name__ == "__main__":
    main()
