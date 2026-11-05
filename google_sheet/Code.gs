// 黄氏族谱（Google 表格脚本）
// 作用：每天自动运行一次，把「新加入成员」表里填好 姓名 和 父亲编号 的人检查一遍，
//       通过的就移到「族谱」表最后，并按「目前最大编号 + 1」自动分配编号；
//       有问题的行会留在原处，并在 D 列写明原因。
//       填表的人只管填，不会马上看到变化；想马上处理，拥有者可以用菜单「族谱工具 → 处理新加入成员」。
// 安装方法见 README.md 的「一次性设置」。这个文件的内容整段复制到 扩展程序 → Apps Script。
//
// 「新加入成员」表的格式：
//   第 1 行是标题；A 列 = 姓名；B 列 = 父亲编号；C 列 = 父亲姓名（公式，给填表人核对用）；D 列 = 处理结果（脚本写入）。
//   C 列每行已有公式（第 2 到 300 行），所以脚本只清空 A、B、D 列的内容，不会删除行。

var SRC_SHEET = "新加入成员";
var DST_SHEET = "族谱";
var RUN_HOUR = 3;   // 每天几点运行（0–23，按脚本所在的时区；Google 会在这一小时内的某个时间运行）

// 只需运行一次：建立「每天运行一次」的触发器，并授权。
// 以后改了 RUN_HOUR，或旧版本留下了「有人编辑就运行」的触发器，重新运行一次 setup() 即可。
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "moveNewMembers") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("moveNewMembers").timeBased().everyDays(1).atHour(RUN_HOUR).create();
  moveNewMembers();
}

// 打开表格时，在菜单栏加一个手动处理按钮
function onOpen() {
  SpreadsheetApp.getUi().createMenu("族谱工具").addItem("处理新加入成员", "moveNewMembers").addToUi();
}

function moveNewMembers() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;   // 同时有别的处理在运行时，不重复处理
  try {
    process_();
  } finally {
    lock.releaseLock();
  }
}

function process_() {
  var ss = SpreadsheetApp.getActive();
  var src = ss.getSheetByName(SRC_SHEET);
  var dst = ss.getSheetByName(DST_SHEET);
  if (!src || !dst) throw new Error("找不到「" + SRC_SHEET + "」或「" + DST_SHEET + "」工作表");

  var srcLast = src.getLastRow();
  if (srcLast < 2) return;
  var rows = src.getRange(2, 1, srcLast - 1, 2).getValues();   // A:B

  // 读出「族谱」现有的人：编号 → 姓名 / 父亲
  var dstLast = dst.getLastRow();
  var existing = dstLast > 1 ? dst.getRange(2, 1, dstLast - 1, 3).getValues() : [];
  var ids = {};
  var siblings = {};          // 父亲编号 → {姓名: true}
  var maxId = 0, lastFilled = 0;
  existing.forEach(function (r, i) {
    var id = String(r[0]).trim();
    if (!/^\d+$/.test(id)) return;
    lastFilled = i + 1;
    ids[id] = true;
    maxId = Math.max(maxId, Number(id));
    var p = String(r[2]).trim();
    (siblings[p] = siblings[p] || {})[String(r[1]).trim()] = true;
  });
  var nextRow = lastFilled + 2;   // 「族谱」里第一个空位（第 1 行是标题）

  var toAdd = [];        // 要写入「族谱」的 [编号, 姓名, 父亲编号]
  var moved = [];        // 已移走的行号（在「新加入成员」里）
  var messages = [];     // [行号, 说明]
  var names = [];

  rows.forEach(function (r, i) {
    var rowNo = i + 2;
    var name = String(r[0]).trim();
    var parent = String(r[1]).trim();
    if (!name && !parent) return;                 // 空行
    if (!name || !parent) return;                 // 还没填完，先不处理

    var problem = "";
    if (/[\s,，`\\]|\$\{/.test(name)) problem = "姓名不能含空格、逗号或特殊符号";
    else if (!/^\d+$/.test(parent)) problem = "父亲编号必须是数字";
    else if (!ids[String(Number(parent))]) problem = "找不到父亲编号 " + parent;
    else if ((siblings[String(Number(parent))] || {})[name]) problem = "这位父亲名下已经有同名的儿子「" + name + "」（如果真是另一个人，请在姓名后加区分）";

    if (problem) {
      messages.push([rowNo, "❌ " + problem]);
      return;
    }
    var id = ++maxId;
    var p = String(Number(parent));
    ids[String(id)] = true;
    (siblings[p] = siblings[p] || {})[name] = true;
    toAdd.push([id, name, Number(parent)]);
    moved.push(rowNo);
    names.push(name);
  });

  if (toAdd.length) {
    dst.getRange(nextRow, 1, toAdd.length, 3).setValues(toAdd);
    moved.forEach(function (rowNo) {
      src.getRange(rowNo, 1, 1, 2).clearContent();
      src.getRange(rowNo, 4).clearContent();
    });
    try { ss.toast("已把 " + toAdd.length + " 人加入「族谱」：" + names.join("、"), "族谱", 8); } catch (err) {}
  }
  messages.forEach(function (m) { src.getRange(m[0], 4).setValue(m[1]); });
}
