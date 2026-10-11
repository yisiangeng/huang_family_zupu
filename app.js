// 黄氏家族谱：读取 data.js 的数据，画出可点击展开的族谱树。
// 一般不需要修改这个文件。
(function () {
  "use strict";

  // 同一代最多同时展开几个人的分支。超过时，自动收起最早展开的那个。
  // 电脑 3 个，手机（窄屏）2 个，避免画面太宽。
  var MAX_OPEN_PER_GENERATION = 3;
  var MAX_OPEN_PER_GENERATION_PHONE = 2;

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

  // 每一代目前展开的人，按展开先后排列（最早的在最前）
  var openByGen = {};

  function maxOpen() {
    var phone = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    return phone ? MAX_OPEN_PER_GENERATION_PHONE : MAX_OPEN_PER_GENERATION;
  }

  function forget(li) {
    var list = openByGen[li._gen] || [];
    var i = list.indexOf(li);
    if (i >= 0) list.splice(i, 1);
  }

  function open(li) {
    var list = openByGen[li._gen] = openByGen[li._gen] || [];
    while (list.length >= maxOpen()) close(list[0]);
    list.push(li);
    var ul = document.createElement("ul");
    li._node.kids.forEach(function (kid) { ul.appendChild(makePerson(kid, li._gen + 1)); });
    li.appendChild(ul);
    li._open = true;
    li.firstChild.setAttribute("aria-expanded", "true");
    reveal(ul);
  }

  function close(li) {
    var ul = li.querySelector(":scope > ul");
    if (ul) {
      // 子孙的分支会一起消失，要从记录里删掉
      Array.prototype.forEach.call(ul.querySelectorAll("li"), function (d) {
        if (d._open) { d._open = false; forget(d); }
      });
      li.removeChild(ul);
    }
    forget(li);
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

  // ---------- 右下角小卡片：点一下收起 ----------
  var ask = document.getElementById("ask");
  if (ask) {
    var hideAsk = function () { ask.hidden = true; };
    ask.addEventListener("click", hideAsk);
    ask.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hideAsk(); }
    });
  }

  // ---------- 缩放：看整棵树 ----------
  var ZOOM_MIN = 0.25, ZOOM_MAX = 1.5, ZOOM_STEP = 1.25;
  var zoom = 1;

  function setZoom(z) {
    var stage = document.getElementById("stage");
    var tree = document.getElementById("tree");
    z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    // 缩放前后保持画面中心不变
    var center = (stage.scrollLeft + stage.clientWidth / 2) / (stage.scrollWidth || 1);
    zoom = z;
    tree.style.zoom = z;
    stage.scrollLeft = center * stage.scrollWidth - stage.clientWidth / 2;
    document.getElementById("zoom-reset").textContent = Math.round(z * 100) + "%";
  }

  // 刚好把整棵树的宽度放进画面（不放大，只缩小）
  function fitZoom() {
    var stage = document.getElementById("stage");
    var tree = document.getElementById("tree");
    tree.style.zoom = 1;
    var width = 0;
    Array.prototype.forEach.call(tree.firstChild.children, function (li) { width += li.offsetWidth; });
    var cs = getComputedStyle(stage);
    var room = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    setZoom(Math.min(1, room / (width || 1)));
    stage.scrollLeft = 0;
  }

  document.getElementById("zoom-out").addEventListener("click", function () { setZoom(zoom / ZOOM_STEP); });
  document.getElementById("zoom-in").addEventListener("click", function () { setZoom(zoom * ZOOM_STEP); });
  document.getElementById("zoom-reset").addEventListener("click", function () { setZoom(1); });
  document.getElementById("zoom-fit").addEventListener("click", fitZoom);

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
