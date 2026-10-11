// 黄氏家族谱：读取 data.js 的数据，画出可点击展开的族谱树。
// 一般不需要修改这个文件。
(function () {
  "use strict";

  // 打开一个人的分支时，自动收起他兄弟已展开的分支（手机上比较不会太宽）。
  // 想同时展开多个兄弟，把 true 改成 false。
  var ONE_BRANCH_AT_A_TIME = true;

  var CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  // ---------- 读取数据 ----------
  function parse(text) {
    var people = {};
    var order = [];
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var cols = line.split(/\t|,|，/);
      if (cols.length < 2) cols = line.split(/\s+/);
      cols = cols.map(function (c) { return c.trim(); });
      var id = cols[0];
      if (!/^\d+$/.test(id)) return;            // 跳过标题行
      var name = cols[1];
      if (!name) return;
      if (people[id]) { console.warn("编号重复：" + id + "（" + name + "）"); return; }
      people[id] = { id: id, name: name, parent: cols[2] || "", kids: [] };
      order.push(id);
    });

    var roots = [];
    order.forEach(function (id) {
      var p = people[id];
      if (p.parent && people[p.parent]) {
        people[p.parent].kids.push(p);
      } else {
        if (p.parent) console.warn("找不到父亲编号 " + p.parent + "（" + p.name + "）");
        roots.push(p);
      }
    });
    // 兄弟按编号排序：编号小的是兄长
    order.forEach(function (id) {
      people[id].kids.sort(function (a, b) { return Number(a.id) - Number(b.id); });
    });
    return { roots: roots, total: order.length };
  }

  function depthOf(nodes) {
    var d = 0;
    nodes.forEach(function (n) { d = Math.max(d, 1 + depthOf(n.kids)); });
    return d;
  }

  function cnNumber(n) {
    if (n <= 10) return CN_NUM[n];
    if (n < 20) return "十" + CN_NUM[n - 10];
    if (n < 100) return CN_NUM[Math.floor(n / 10)] + "十" + (n % 10 ? CN_NUM[n % 10] : "");
    return String(n);
  }

  // ---------- 画树 ----------
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makePerson(node, gen) {
    var li = document.createElement("li");
    li.className = "g" + gen + (gen >= 4 ? " deep" : "");
    li._node = node;
    li._gen = gen;

    var hasKids = node.kids.length > 0;
    var tag = document.createElement(hasKids ? "button" : "div");
    tag.className = "tag";

    var name = document.createElement("span");
    name.className = "name";
    // 每个字一个 span，方便竖排显示
    Array.from(node.name).forEach(function (ch) {
      var s = document.createElement("span");
      s.textContent = ch;
      name.appendChild(s);
    });
    tag.appendChild(name);

    if (hasKids) {
      tag.type = "button";
      tag.setAttribute("aria-expanded", "false");
      tag.setAttribute("aria-label", node.name + "，" + node.kids.length + "个儿子");
      var count = document.createElement("span");
      count.className = "count";
      count.setAttribute("aria-hidden", "true");
      count.textContent = node.kids.length;
      tag.appendChild(count);
      tag.addEventListener("click", function () { toggle(li); });
    }
    li.appendChild(tag);
    return li;
  }

  function open(li) {
    if (ONE_BRANCH_AT_A_TIME && li.parentNode) {
      Array.prototype.forEach.call(li.parentNode.children, function (sib) {
        if (sib !== li && sib._open) close(sib);
      });
    }
    var ul = document.createElement("ul");
    li._node.kids.forEach(function (kid) { ul.appendChild(makePerson(kid, li._gen + 1)); });
    li.appendChild(ul);
    li._open = true;
    li.firstChild.setAttribute("aria-expanded", "true");
    reveal(ul);
  }

  function close(li) {
    var ul = li.querySelector(":scope > ul");
    if (ul) li.removeChild(ul);
    li._open = false;
    li.firstChild.setAttribute("aria-expanded", "false");
  }

  function toggle(li) {
    if (li._open) close(li); else open(li);
  }

  // 展开后，把新出现的一代滚到画面中间（手机上特别有用）
  function reveal(ul) {
    requestAnimationFrame(function () {
      var stage = document.getElementById("stage");
      var s = stage.getBoundingClientRect();
      var r = ul.getBoundingClientRect();
      var target = stage.scrollLeft + (r.left + r.width / 2) - (s.left + s.width / 2);
      stage.scrollTo({ left: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });

      var bottom = r.bottom + 40;
      if (bottom > window.innerHeight) {
        window.scrollBy({ top: bottom - window.innerHeight, behavior: reduceMotion ? "auto" : "smooth" });
      }
    });
  }

  // ---------- 启动 ----------
  var data = parse(typeof FAMILY_DATA === "string" ? FAMILY_DATA : "");
  var tree = document.getElementById("tree");
  var meta = document.getElementById("meta");

  if (!data.total) {
    tree.innerHTML = '<p class="hint">没有读到族谱数据，请检查 data.js。</p>';
    return;
  }

  meta.textContent = cnNumber(depthOf(data.roots)) + "代 · " + data.total + "人";

  var rootList = document.createElement("ul");
  data.roots.forEach(function (r) { rootList.appendChild(makePerson(r, 1)); });
  tree.appendChild(rootList);
})();
