#!/usr/bin/env python3
"""从族谱表格生成 data.js。

用法：python build_data.py [来源] [输出路径]
来源可以是：
  - Google 表格「发布到网络」的 CSV 链接（http 开头）
  - 本地的 .csv 文件
  - 本地的 .xlsx 文件（需要「族谱」工作表）
不写来源时：如果 sheet_url.txt 里有链接就用链接，否则用 data.xlsx。
只读取 A 到 C 列（编号、姓名、父亲编号），第一行是标题；其他列不会进入网站。
数据有错误时会列出所有问题并退出（退出码 1），不会覆盖 data.js。
"""
import csv
import io
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "data.js"
SHEET = "族谱"

HEADER = """\
// 黄氏族谱数据 —— 由 build_data.py 从族谱表格自动生成，请不要手动修改。
// 更新方法：只需修改族谱表格（Google 表格），网站会定期自动重新生成本文件。
// 格式：编号  姓名  父亲编号（Tab 分隔）。始祖的父亲编号留空。

const FAMILY_DATA = `
"""


def default_source():
    url_file = HERE / "sheet_url.txt"
    if url_file.exists():
        for line in url_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("http"):
                return line
    return str(HERE / "data.xlsx")


def load_rows(source):
    """返回 (来源名称, 行列表)。每行是 (编号, 姓名, 父亲编号)，不含标题行（第一行数据对应表格第 2 行）。"""
    if source.startswith("http"):
        req = urllib.request.Request(source, headers={"User-Agent": "huang-zupu-build"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8-sig")
        if text.lstrip().lower().startswith("<"):
            sys.exit("错误：下载到的不是 CSV。请确认 Google 表格已「发布到网络」，并选择「族谱」工作表和 CSV 格式。")
        return "Google 表格", rows_from_csv(text)
    path = Path(source)
    if not path.exists():
        sys.exit(f"错误：找不到 {path}")
    if path.suffix.lower() == ".csv":
        return path.name, rows_from_csv(path.read_text(encoding="utf-8-sig"))
    import openpyxl  # 只有读 Excel 时才需要
    wb = openpyxl.load_workbook(path, data_only=True)
    if SHEET not in wb.sheetnames:
        sys.exit(f"错误：{path.name} 里找不到名为「{SHEET}」的工作表")
    return path.name, list(wb[SHEET].iter_rows(min_row=2, max_col=3, values_only=True))


def rows_from_csv(text):
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # 标题行
    rows = []
    for r in reader:
        r = (r + ["", "", ""])[:3]
        rows.append(tuple(c.strip() or None for c in r))
    return rows


def as_id(value, where, errors):
    """把单元格转成整数编号的字符串；空格返回 ''。"""
    if value is None or (isinstance(value, str) and not value.strip()):
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    if not re.fullmatch(r"\d+", text):
        errors.append(f"{where}：编号“{text}”不是数字")
        return ""
    return str(int(text))


def read_people(rows):
    errors, people = [], []
    for row_no, row in enumerate(rows, start=2):
        raw_id, raw_name, raw_parent = row
        name = "" if raw_name is None else str(raw_name).strip()
        if raw_id is None and not name and raw_parent is None:
            continue  # 空行
        where = f"第 {row_no} 行"
        n_before = len(errors)
        pid = as_id(raw_id, where, errors)
        parent = as_id(raw_parent, where + "的父亲", errors)
        if not pid:
            if len(errors) == n_before:
                errors.append(f"{where}：缺少编号（姓名：{name or '空'}）")
            continue
        if not name:
            errors.append(f"{where}：编号 {pid} 没有姓名")
            continue
        if re.search(r"[\s,，`\\]|\$\{", name):
            errors.append(f"{where}：姓名“{name}”含有空格、逗号或特殊符号")
            continue
        people.append((row_no, pid, name, parent))
    return people, errors


def validate(people, errors):
    seen = {}
    for row_no, pid, name, _ in people:
        if pid in seen:
            errors.append(f"第 {row_no} 行：编号 {pid}（{name}）与第 {seen[pid]} 行重复")
        else:
            seen[pid] = row_no
    parent_of = {pid: parent for _, pid, _, parent in people}
    roots = [pid for pid, parent in parent_of.items() if not parent]
    for row_no, pid, name, parent in people:
        if parent == pid:
            errors.append(f"第 {row_no} 行：{name} 的父亲编号是自己")
        elif parent and parent not in parent_of:
            errors.append(f"第 {row_no} 行：{name} 的父亲编号 {parent} 不存在")
    # 循环检查（A 的父亲是 B，B 的父亲又是 A）
    for pid in parent_of:
        cur, steps = pid, 0
        while cur and cur in parent_of and steps <= len(parent_of):
            cur, steps = parent_of[cur], steps + 1
        if steps > len(parent_of):
            errors.append(f"编号 {pid} 的父亲关系形成了循环")
            break
    if len(roots) != 1:
        names = "、".join(f"{pid}" for pid in roots) or "无"
        errors.append(f"应该只有一位始祖（父亲编号留空），目前有 {len(roots)} 位（编号：{names}）")


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else default_source()
    label, rows = load_rows(source)
    people, errors = read_people(rows)
    validate(people, errors)
    if errors:
        print(f"{label} 有 {len(errors)} 个问题，data.js 没有更新：", file=sys.stderr)
        for e in errors:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)

    lines = ["编号\t姓名\t父亲编号"] + [f"{pid}\t{name}\t{parent}" for _, pid, name, parent in people]
    content = HEADER + "\n".join(lines) + "\n`;\n"
    if OUT.exists() and OUT.read_text(encoding="utf-8") == content:
        print(f"{OUT.name} 已是最新（{len(people)} 人，来源：{label}），无需更改")
        return
    OUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"已生成 {OUT.name}：{len(people)} 人（来源：{label}）")


if __name__ == "__main__":
    main()
