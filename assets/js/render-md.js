/* 轻量本地 Markdown 渲染器：不依赖任何外部库/CDN。
   支持：标题、段落、粗斜体、行内码、链接、图片、hr、无序/有序列表、任务checkbox、
   引用块、围栏代码块、表格。其余标签一律转义，保证安全。 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 行内标记：反引号代码、粗体、斜体、链接、图片
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, function (_, c) { return "<code>" + esc(c) + "</code>"; })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) { return '<img src="' + esc(src) + '" alt="' + esc(alt) + '">'; })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, txt, url) {
        var u = /^[a-z]+:/i.test(url) || url.charAt(0) === "/" ? url : url;
        return '<a href="' + esc(u) + '"' + (u.charCodeAt(0) === 35 ? "" : ' target="_blank" rel="noopener"') + ">" + txt + "</a>";
      });
  }

  function para(text) {
    return "<p>" + inline(text.trim()) + "</p>";
  }

  // 收集并渲染一段表格。返回 {html, nextIndex}
  function tableBlock(lines, i) {
    var rows = [];
    while (i < lines.length && lines[i].trim() !== "" && /^\s*\|/.test(lines[i])) {
      rows.push(lines[i]);
      i++;
    }
    function cells(row) {
      return row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(function (c) { return c.trim(); });
    }
    var header = cells(rows[0]);
    var bodyRows = [];
    for (var k = 1; k < rows.length; k++) {
      var c = cells(rows[k]);
      // 分隔行如 |---|:---:|
      if (c.length && /^:?-{2,}:?$/.test(c.join("").replace(/\s/g, ""))) continue;
      bodyRows.push(c);
    }
    var h =
      "<div class=\"md-table-wrap\"><table><thead><tr>" +
      header.map(function (h) { return "<th>" + inline(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>";
    for (var r = 0; r < bodyRows.length; r++) {
      var rc = bodyRows[r];
      while (rc.length < header.length) rc.push("");
      h += "<tr>" + rc.map(function (td) { return "<td>" + inline(td) + "</td>"; }).join("") + "</tr>";
    }
    h += "</tbody></table></div>";
    return { html: h, nextIndex: i };
  }

  function render(md) {
    if (!md) return "";
    md = String(md).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = md.split("\n");
    var out = "";
    var code = "";
    var codeOpen = false;
    var listOpen = false;
    var listOrdered = false;
    var paraBuf = [];

    function flushList() {
      if (listOpen) {
        out += (listOrdered ? "</ol>\n" : "</ul>\n");
        listOpen = false;
      }
    }
    function flushPara() {
      if (paraBuf.length) {
        out += para(paraBuf.join("\n")) + "\n";
        paraBuf = [];
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var t = raw;

      // 围栏代码块
      if (/^\s*```/.test(t)) {
        if (codeOpen) {
          out += "<pre><code>" + esc(code.replace(/\n$/, "")) + "</code></pre>\n";
          code = "";
          codeOpen = false;
        } else {
          flushList(); flushPara();
          codeOpen = true;
        }
        continue;
      }
      if (codeOpen) { code += t + "\n"; continue; }

      // 空行 / 分隔线
      if (t.trim() === "") { flushList(); flushPara(); continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(t)) {
        flushList(); flushPara(); out += "<hr>\n"; continue;
      }

      // 表格
      if (/^\s*\|/.test(t)) {
        flushList(); flushPara();
        var tb = tableBlock(lines, i);
        out += tb.html + "\n";
        i = tb.nextIndex - 1;
        continue;
      }

      // 引用
      if (/^\s*>/.test(t)) {
        flushList(); flushPara();
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        i--;
        out += "<blockquote>" + render(quote.join("\n")) + "</blockquote>\n";
        continue;
      }

      // 标题
      var h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushList(); flushPara();
        var lv = h[1].length;
        // 教程中 # 用大标题，映射到 1..5 层级，避免 h1 太大
        out += "<h" + lv + " id=\"" + slug(h[2]) + "\">" + inline(h[2]) + "</h" + lv + ">\n";
        continue;
      }

      // 列表（无序 / 有序 / checkbox）
      var li = t.match(/^\s*([-*+])[\t ]+(.*)$/) || t.match(/^\s*(\d+)[.)][\t ]+(.*)$/);
      if (li) {
        var ordered = li[1][0].toLowerCase() !== "-" && li[1] !== "*" && li[1] !== "+" && /^\d/.test(li[1]);
        if (!listOpen) {
          out += ordered ? "<ol>\n" : "<ul>\n";
          listOpen = true;
          listOrdered = ordered;
        } else if (listOrdered !== ordered) {
          out += (listOrdered ? "</ol>\n<ul>\n" : "</ul>\n<ol>\n");
          listOrdered = ordered;
        }
        flushPara();
        var body = li[2];
        var cb = body.match(/^\[([ xX])\]\s*(.*)$/);
        if (cb) {
          var checked = cb[1].toLowerCase() === "x";
          out +=
            "<li class=\"cb " + (checked ? "cb--on" : "") + "\">" +
            '<span class="cb-box"><svg viewBox="0 0 14 14"><path d="M3 7.2 6 10l5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            "<span>" + inline(cb[2]) + "</span></li>\n";
        } else {
          out += "<li>" + inline(body) + "</li>\n";
        }
        continue;
      }
      if (listOpen && /^\s*$/.test(t)) { continue; }
      if (listOpen && !/^\s*[-*+]\s/.test(t) && !/^\s*\d+[.)]\s/.test(t)) {
        flushList();
      }

      // 普通段落积攒
      paraBuf.push(t);
    }
    flushList(); flushPara();
    if (codeOpen) { out += "<pre><code>" + esc(code) + "</code></pre>\n"; }
    return out;
  }

  function slug(s) {
    return "sec-" + s.toString().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-").slice(0, 40);
  }

  window.renderMarkdown = render;
})();