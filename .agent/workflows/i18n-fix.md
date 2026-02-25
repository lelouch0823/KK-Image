---
description: 检查并补全多语言 (i18n) 字符串缺失
---
# i18n 检查与补全工作流 (i18n Check & Fix Workflow)

该工作流指导您使用项目提供的 `scripts/check-i18n.mjs` 脚本来扫描源码，找出存在的冗余、缺失、不同步等语言字符串问题，并将其补全到对应的语言包中。

## 步骤 1: 扫描并生成建议报告
首先执行 i18n 检查脚本，附带 `--fix-report` 参数。该参数会在根目录生成一个 `i18n-fix-report.md` 的辅助文件，方便大模型提取需要补全的键。
// turbo
`node scripts/check-i18n.mjs --fix-report`

## 步骤 2: 读取并分析结果
如果上一步提示存在缺失或不一致的键，并提示已经生成写入了修复建议文件，请去读取该文件：
`Get-Content i18n-fix-report.md`
或者直接查看终端报错里的 Missing、Asymmetric、Empty 相关缺失内容。

## 步骤 3: 补全并更新语言包
根据步骤 2 得到的结果，修改相关的语言包文件，一般为：
- `src/locales/zh-CN/index.js` (或其包含的其他子模块拆分文件)
- `src/locales/en/index.js` (或其包含的其他子模块拆分文件)
请根据上下文翻译补全缺失的英/中文内容，并确保插值模板如 `{xxx}` 在所有语言之间严格一致。

## 步骤 4: 严格模式复查
所有修改保存后，运行严格模式的 i18n 检查脚本进行复验，确保无论是缺失还是孤儿键 (Orphan keys) 问题都已彻底解决：
// turbo
`node scripts/check-i18n.mjs --strict`

## 步骤 5: 清理临时文件
确认没有警告或报错后，删除刚才生成的临时修复建议文件（如果文件存在）：
// turbo
`Remove-Item -Path i18n-fix-report.md -ErrorAction SilentlyContinue`
