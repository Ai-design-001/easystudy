/* 英文写作检查器：拼写 + 常见语法错误（规则式，离线可用）
   - 不做语义判断，只抓 A0–B1 最高频的硬错误
   - 每条结果带 index/length，方便在原文里划线
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ENGLISH_CHECKER = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function tokenize(text) {
    var out = [], m, re = /[A-Za-z][A-Za-z']*/g;
    while ((m = re.exec(text)) !== null) {
      out.push({ word: m[0], index: m.index, length: m[0].length });
    }
    return out;
  }

  var CONTRACTIONS = ("don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't " +
    "haven't hasn't hadn't mustn't i'm i've i'll i'd you're you've you'll you'd he's he'll she's she'll it's " +
    "we're we've we'll they're they've they'll that's there's here's what's who's let's o'clock").split(/\s+/);

  // 词形还原：把 books / worked / running 归到原形，减少误报
  function baseForms(w) {
    var lw = w.toLowerCase();
    var forms = [lw];
    if (/['’]s$/.test(lw)) forms.push(lw.replace(/['’]s$/, ""));
    if (/['’]/.test(lw)) forms.push(lw.split(/['’]/)[0]);
    if (/es$/.test(lw) && lw.length >= 4) forms.push(lw.slice(0, -2));
    if (/s$/.test(lw) && lw.length > 3) forms.push(lw.slice(0, -1));
    if (/ies$/.test(lw) && lw.length > 4) forms.push(lw.slice(0, -3) + "y");
    if (/ed$/.test(lw) && lw.length > 4) { forms.push(lw.slice(0, -2)); forms.push(lw.slice(0, -1)); }
    if (/ing$/.test(lw) && lw.length > 5) {
      forms.push(lw.slice(0, -3));
      forms.push(lw.slice(0, -3) + "e");
      if (/([b-df-hj-np-tv-z])\1ing$/.test(lw)) forms.push(lw.slice(0, -4));
    }
    if (/er$/.test(lw) && lw.length > 4) { forms.push(lw.slice(0, -2)); forms.push(lw.slice(0, -1)); }
    if (/est$/.test(lw) && lw.length > 5) { forms.push(lw.slice(0, -3)); forms.push(lw.slice(0, -2)); }
    return forms;
  }

  function buildDict(wordList) {
    var map = Object.create(null);
    wordList.forEach(function (w) {
      String(w).toLowerCase().split(/\s+/).forEach(function (part) {
        if (part) map[part] = true;
      });
    });
    CONTRACTIONS.forEach(function (c) { map[c] = true; });
    return map;
  }

  function known(word, dict) {
    var forms = baseForms(word);
    for (var i = 0; i < forms.length; i++) if (dict[forms[i]]) return true;
    return false;
  }

  function suggest(word, dict) {
    var lw = word.toLowerCase();
    var best = null, bestD = 99;
    var maxD = lw.length <= 4 ? 1 : (lw.length <= 7 ? 2 : 3);
    for (var k in dict) {
      if (Math.abs(k.length - lw.length) > maxD) continue;
      if (k.charAt(0) !== lw.charAt(0) && lw.length > 4) continue;
      var d = levenshtein(lw, k);
      if (d < bestD && d <= maxD) { bestD = d; best = k; }
    }
    return bestD <= maxD ? best : null;
  }

  var GRAMMAR_RULES = [
    { re: /\b(a)\s+(?=[aeio])/gi, type: "grammar", msg: "元音音素前用 an", fix: function (s) { return s.replace(/^a/i, "an"); } },
    { re: /\b(an)\s+(?=[bcdfgjklmnpqrstvwxyz])/gi, type: "grammar", msg: "辅音音素前用 a", fix: function (s) { return s.replace(/^an/i, "a"); } },
    { re: /\b(he|she|it)\s+don't\b/gi, type: "grammar", msg: "第三人称单数用 doesn't", fix: function (s) { return s.replace(/don't/i, "doesn't"); } },
    { re: /\b(i|we|you|they)\s+doesn't\b/gi, type: "grammar", msg: "这些人称用 don't", fix: function (s) { return s.replace(/doesn't/i, "don't"); } },
    { re: /\bi\s+has\b/gi, type: "grammar", msg: "I 后面用 have", fix: function (s) { return s.replace(/has/i, "have"); } },
    { re: /\b(he|she|it)\s+have\b/gi, type: "grammar", msg: "第三人称单数用 has", fix: function (s) { return s.replace(/have/i, "has"); } },
    // 第三人称单数 + 常见动词原形（排除情态动词和已变形）
    { re: /\b(he|she|it)\s+(go|come|want|need|like|eat|take|make|do|study|work|ask|say|get|know|think|watch|read|write|play|live|help|look|feel|seem|keep|give|find|tell|call|try|use|show|leave|move|run|walk|talk|speak|drink|sleep|buy|sell|open|close|start|stop|end|pay|meet|send|bring|carry|enjoy|visit|learn|teach)\b(?!\s*(s|ed|ing|ly))\b/gi, type: "grammar", msg: "第三人称单数动词要加 -s", fix: function (s) {
      var parts = s.split(/\s+/);
      var v = parts[parts.length - 1];
      var pv = v;
      if (/(ch|sh|ss|x|z|o)$/i.test(v)) pv = v + "es";
      else if (/[^aeiou]y$/i.test(v)) pv = v.slice(0, -1) + "ies";
      else pv = v + "s";
      parts[parts.length - 1] = pv;
      return parts.join(" ");
    } },
    // the man / the woman / my friend 等单数主语 + 动词原形（只报最常见的几个动词，避免误报）
    { re: /\b(the (?:man|woman|boy|girl|teacher|doctor|student|driver|waiter|person)|my (?:friend|brother|sister|father|mother|dad|mom|son|daughter))\s+(ask|say|want|need|like|go|come|have|do|make|take|get|know|think|work|live|help|look|feel)\b(?!\s*(s|ed|ing))\b/gi, type: "grammar", msg: "单数主语后面动词要加 -s", fix: function (s) {
      var parts = s.split(/\s+/);
      var v = parts[parts.length - 1];
      var pv;
      if (/(ch|sh|ss|x|z|o)$/i.test(v)) pv = v + "es";
      else if (/[^aeiou]y$/i.test(v)) pv = v.slice(0, -1) + "ies";
      else pv = v + "s";
      parts[parts.length - 1] = pv;
      return parts.join(" ");
    } },
    { re: /\bi\s+is\b/gi, type: "grammar", msg: "I 后面用 am", fix: function (s) { return s.replace(/is/i, "am"); } },
    { re: /\b(they|we|you)\s+is\b/gi, type: "grammar", msg: "复数主语用 are", fix: function (s) { return s.replace(/is/i, "are"); } },
    { re: /\b(he|she|it)\s+are\b/gi, type: "grammar", msg: "单数主语用 is", fix: function (s) { return s.replace(/are/i, "is"); } },
    { re: /\b(am|is|are)\s+(go|come|want|need|like|eat|take|make|do|study|work)\b(?!\s*ing)/gi, type: "grammar", msg: "be 后面不能直接跟动词原形，用 -ing 或去掉 be", fix: null },
    { re: /\b(want|need|like|hope|plan|decide|try|begin|start)\s+(go|eat|see|buy|do|have|take|make|study|work|come)\b(?!\s*(to|ing))/gi, type: "grammar", msg: "这些动词后面要加 to", fix: function (s) { return s.replace(/\s+/, " to "); } },
    { re: /\bmore\s+(better|worse|easier|harder|bigger|smaller|cheaper|older|younger)\b/gi, type: "grammar", msg: "比较级不能叠加 more", fix: function (s) { return s.replace(/more\s+/i, ""); } },
    { re: /\bmost\s+(best|worst|easiest|hardest|biggest|smallest|cheapest)\b/gi, type: "grammar", msg: "最高级不能叠加 most", fix: function (s) { return s.replace(/most\s+/i, ""); } },
    { re: /\bpeoples\b/gi, type: "grammar", msg: "people 本身是复数", fix: function () { return "people"; } },
    { re: /\binformations\b/gi, type: "grammar", msg: "information 不可数，不加 -s", fix: function () { return "information"; } },
    { re: /\badvices\b/gi, type: "grammar", msg: "advice 不可数，不加 -s", fix: function () { return "advice"; } },
    { re: /\bequipments\b/gi, type: "grammar", msg: "equipment 不可数", fix: function () { return "equipment"; } },
    { re: /\bexplain\s+me\b/gi, type: "grammar", msg: "explain 后面要加 to：explain to me", fix: function () { return "explain to me"; } },
    { re: /\bdiscuss\s+about\b/gi, type: "grammar", msg: "discuss 后面不加 about", fix: function () { return "discuss"; } },
    { re: /\bdepends?\s+of\b/gi, type: "grammar", msg: "depend 后面用 on", fix: function (s) { return s.replace(/of/i, "on"); } },
    { re: /\b(interested|good|bad)\s+about\b/gi, type: "grammar", msg: "interested in / good at，不用 about", fix: null },
    { re: /\bmarried\s+with\b/gi, type: "grammar", msg: "married to，不用 with", fix: function () { return "married to"; } },
    { re: /\b(don't|doesn't|didn't)\s+(have|has|had)\s+no\b/gi, type: "grammar", msg: "双重否定：don't have any / have no", fix: function (s) { return s.replace(/\s+no$/i, " any"); } }
  ];

  function check(text, dict) {
    text = String(text || "");
    var issues = [];
    var tokens = tokenize(text);
    var seen = {};

    // 1. 拼写
    tokens.forEach(function (t) {
      if (t.word.length < 3) return;
      if (/^[A-Z]{2,}$/.test(t.word)) return;      // 全大写缩写
      if (/^[A-Z]/.test(t.word) && t.index > 0) return;  // 句中大写 = 专有名词，跳过
      if (known(t.word, dict)) return;
      var s = suggest(t.word, dict);
      if (!s) return;                              // 完全不认识 → 不报（专有名词/生词太多）
      // 只有「很接近某个已知词」才报拼写错误
      var key = t.index;
      if (seen[key]) return;
      seen[key] = true;
      issues.push({
        type: "spelling", index: t.index, length: t.length, word: t.word,
        message: "拼写可能不对：" + t.word + " → " + s,
        suggestion: s
      });
    });

    // 2. 语法规则
    GRAMMAR_RULES.forEach(function (rule) {
      var m;
      rule.re.lastIndex = 0;
      while ((m = rule.re.exec(text)) !== null) {
        var idx = m.index;
        if (seen[idx]) continue;
        seen[idx] = true;
        var fixed = rule.fix ? rule.fix(m[0]) : null;
        issues.push({
          type: rule.type, index: idx, length: m[0].length, word: m[0],
          message: rule.msg + (fixed && fixed !== m[0] ? (" → " + fixed) : ""),
          suggestion: fixed && fixed !== m[0] ? fixed : null
        });
        if (m[0].length === 0) rule.re.lastIndex++;
      }
    });

    // 3. 大小写：句首
    var sentenceRe = /(^|[.!?]\s+)([a-z])/g, sm;
    while ((sm = sentenceRe.exec(text)) !== null) {
      var pos = sm.index + sm[1].length;
      issues.push({
        type: "style", index: pos, length: 1, word: sm[2],
        message: "句首字母要大写", suggestion: sm[2].toUpperCase()
      });
    }

    // 3b. 第一人称代词 i 要大写
    var iRe = /\bi\b/g, im;
    while ((im = iRe.exec(text)) !== null) {
      if (seen[im.index]) continue;
      seen[im.index] = true;
      issues.push({
        type: "style", index: im.index, length: 1, word: "i",
        message: "第一人称 I 要大写",
        suggestion: "I"
      });
    }

    // 4. 结尾标点
    var trimmed = text.replace(/\s+$/, "");
    if (trimmed.length > 2 && !/[.!?]$/.test(trimmed)) {
      issues.push({
        type: "punctuation", index: trimmed.length, length: 0, word: "",
        message: "句末缺标点（. ? !）", suggestion: "."
      });
    }

    issues.sort(function (a, b) { return a.index - b.index; });

    var wordCount = tokens.length;
    var sentenceCount = (text.match(/[.!?]+/g) || []).length || (wordCount ? 1 : 0);
    return {
      issues: issues,
      stats: {
        words: wordCount,
        sentences: sentenceCount,
        chars: text.length,
        errors: issues.length
      }
    };
  }

  // 把文本切成 HTML：认识的词包成可悬停的 span
  function annotate(text, lookup, escapeFn) {
    var esc = escapeFn || function (s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    var out = "", last = 0, re = /[A-Za-z][A-Za-z']*/g, m;
    while ((m = re.exec(text)) !== null) {
      out += esc(text.slice(last, m.index));
      var info = lookup(m[0]);
      if (info) {
        out += '<span class="wt" data-w="' + esc(m[0].toLowerCase()) + '" tabindex="0">' + esc(m[0]) + "</span>";
      } else {
        out += esc(m[0]);
      }
      last = m.index + m[0].length;
    }
    out += esc(text.slice(last));
    return out;
  }

  return { check: check, levenshtein: levenshtein, tokenize: tokenize, buildDict: buildDict, annotate: annotate };
});
