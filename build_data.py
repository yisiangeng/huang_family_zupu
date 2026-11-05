#!/usr/bin/env python3
"""从族谱表格生成 data.js 和 族谱备份.xlsx。

用法：python build_data.py [来源] [输出路径]
来源可以是：
  - Google 表格「发布到网络」的 CSV 链接（http 开头）
  - 本地的 .csv 文件
不写来源时，使用 sheet_url.txt 里的链接。
只读取 A 到 C 列（编号、姓名、父亲编号）生成 data.js，第一行是标题；其他列不会进入网站。
名单有变化时，会同时把整个「族谱」工作表存成 族谱备份.xlsx（只读备份，每次都会被覆盖），放在 data.js 旁边。
数据有错误时会列出所有问题并退出（退出码 1），不会覆盖任何文件。
需要：pip install openpyxl（只用来写备份）
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
BACKUP_NAME = "族谱备份.xlsx"

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
    sys.exit("错误：sheet_url.txt 里没有 Google 表格的 CSV 链接（发布到网络后得到的链接）")


def load_rows(source):
    """返回 (来源名称, 行列表, 完整表格)。行是 (编号, 姓名, 父亲编号)，不含标题行（第一行数据对应表格第 2 行）；
    完整表格包含标题行和所有列，用来写备份。"""
    if source.startswith("http"):
        req = urllib.request.Request(source, headers={"User-Agent": "huang-zupu-build"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8-sig")
        if text.lstrip().lower().startswith("<"):
            sys.exit("错误：下载到的不是 CSV。请确认 Google 表格已「发布到网络」，并选择「族谱」工作表和 CSV 格式。")
        label = "Google 表格"
    else:
        path = Path(source)
        if path.suffix.lower() != ".csv" or not path.exists():
            sys.exit(f"错误：来源必须是 CSV 链接或存在的 .csv 文件：{source}")
        text = path.read_text(encoding="utf-8-sig")
        label = path.name
    table = list(csv.reader(io.StringIO(text)))
    return label, rows_from_csv(text), table


def rows_from_csv(text):
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # 标题行
    rows = []
    for r in reader:
        r = (r + ["", "", ""])[:3]
        rows.append(tuple(c.strip() or None for c in r))
    return rows


def write_backup(path, table):
    """把完整的「族谱」表存成 xlsx（只读备份）。"""
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill

    while table and not any(c.strip() for c in table[-1]):
        table = table[:-1]            # 去掉末尾的空行
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = SHEET
    for r, row in enumerate(table, start=1):
        for c, value in enumerate(row, start=1):
            value = value.strip()
            cell = ws.cell(row=r, column=c, value=int(value) if re.fullmatch(r"\d+", value) else (value or None))
            cell.alignment = Alignment(horizontal="center" if c != 6 else "left")
            if r == 1:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor="7A6A58")
    for col, width in zip("ABCDEF", (8, 12, 11, 12, 9, 30)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    wb.save(path)


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
    label, rows, table = load_rows(source)
    people, errors = read_people(rows)
    validate(people, errors)
    if errors:
        print(f"{label} 有 {len(errors)} 个问题，data.js 没有更新：", file=sys.stderr)
        for e in errors:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)

    lines = ["编号\t姓名\t父亲编号"] + [f"{pid}\t{name}\t{parent}" for _, pid, name, parent in people]
    content = HEADER + "\n".join(lines) + "\n`;\n"
    backup = OUT.with_name(BACKUP_NAME)
    changed = not (OUT.exists() and OUT.read_text(encoding="utf-8") == content)
    if changed:
        OUT.write_text(content, encoding="utf-8", newline="\n")
        print(f"已生成 {OUT.name}：{len(people)} 人（来源：{label}）")
    else:
        print(f"{OUT.name} 已是最新（{len(people)} 人，来源：{label}），无需更改")
    if changed or not backup.exists():
        write_backup(backup, table)
        print(f"已生成 {backup.name}")


if __name__ == "__main__":
    main()
