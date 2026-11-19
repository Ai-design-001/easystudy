/* 出国英语 · 每日陪练
   纯前端、零依赖、离线可用。数据存在 localStorage。
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var DATA = window.APP_DATA;
  var PACKS = (window.APP_DATA_PACKS && window.APP_DATA_PACKS.packs) || [];
  var EXAM = window.APP_DATA_EXAM || { grammar: [], exam: {} };
  var CORE = (window.APP_DATA_CORE && window.APP_DATA_CORE.batches) || [];
  var STORAGE_KEY = "english-coach.state.v1";
  /* 版本号：ES 1.0 为基线。小改动 +0.1，大改动 +1.0 */
  var APP_VERSION = "v6.3";
  try { document.documentElement.setAttribute("data-app-version", APP_VERSION); } catch (e) {}
  var BOX_DAYS = [1, 2, 4, 7, 15, 30, 60];

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function todayKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function addDays(key, n) {
    var p = key.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return todayKey(d);
  }
  function diffDays(a, b) {
    var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    var da = new Date(pa[0], pa[1] - 1, pa[2]);
    var db = new Date(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  /* ---------------- 状态 ---------------- */
  var memoryFallback = null;

  function defaultState() {
    return {
      createdAt: todayKey(),
      settings: { rate: 1.0, voiceURI: "", minutesTarget: 60, fontScale: "normal", accent: "en-US", theme: "system", edgeVoice: "en-US-AriaNeural", packVoice: "aria", cardMode: "both", aiProvider: "deepseek", aiKey: "", aiModel: "" },
      days: {},
      srs: {},
      patterns: {},
      sentences: [],
      draft: "",
      customPacks: [],
      focus: null,
      speaking: { history: [], scenario: "free" },
      writing: {},
      weak: {},
      sessions: {},
      quiz: { lastScore: null, lastAt: null }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return defaultState();
      var base = defaultState();
      base.createdAt = s.createdAt || base.createdAt;
      base.settings = Object.assign(base.settings, s.settings || {});
      base.days = s.days || {};
      base.srs = s.srs || {};
      base.patterns = s.patterns || {};
      base.sentences = s.sentences || [];
      base.draft = s.draft || "";
      base.customPacks = Array.isArray(s.customPacks) ? s.customPacks : [];
      base.focus = s.focus || null;
      base.writing = (s.writing && typeof s.writing === 'object') ? s.writing : {};
      base.weak = (s.weak && typeof s.weak === 'object') ? s.weak : {};
      base.sessions = (s.sessions && typeof s.sessions === 'object') ? s.sessions : {};
      base.speaking = (s.speaking && typeof s.speaking === 'object' && Array.isArray(s.speaking.history))
        ? s.speaking : { history: [], scenario: "free" };
      base.quiz = Object.assign(base.quiz, s.quiz || {});
      // 语速迁移：老版本默认 0.8，现在统一 1.0x
      if (base.settings.rate == null || Math.abs(base.settings.rate - 0.8) < 0.001) {
        base.settings.rate = 1.0;
      }
      if (base.settings.dictSpeed == null || Math.abs(base.settings.dictSpeed - 0.8) < 0.001) {
        base.settings.dictSpeed = 1.0;
      }
      return base;
    } catch (e) {
      return memoryFallback || defaultState();
    }
  }

  var state = loadState();
  memoryFallback = state;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { memoryFallback = state; }
    if (window.pywebview && window.pywebview.api && window.DesktopStore) {
      window.DesktopStore.save(state);
    }
  }

  /* ---------------- 音标 ---------------- */
  function ipaOf(text) {
    var M = window.IPA || {};
    var raw = String(text == null ? "" : text);
    var lower = raw.toLowerCase();
    if (M.words && M.words[lower]) return M.words[lower];
    if (M.sentences && M.sentences[raw]) return M.sentences[raw];
    if (M.sentences && M.sentences[lower]) return M.sentences[lower];
    return "";
  }

  function ipaHtml(text, cls) {
    var ipa = ipaOf(text);
    if (!ipa) return "";
    return '<div class="ipa' + (cls ? " " + cls : "") + '">/' + esc(ipa.replace(/^\/|\/$/g, "")) + "/</div>";
  }

  /* ---------------- 日期与场景 ---------------- */
  function dayIndex() {
    var n = diffDays(state.createdAt, todayKey());
    return n < 0 ? 0 : n;
  }

  // 14 天一个循环：机场 2 天 → 海关 2 天 → 酒店 3 天 → 餐厅 3 天 → 交通 2 天 → 购物 2 天
  var CYCLE = ["airport", "airport", "customs", "customs", "hotel", "hotel", "hotel",
    "restaurant", "restaurant", "restaurant", "transport", "transport", "shopping", "shopping"];

  function scenarioById(id) {
    for (var i = 0; i < DATA.scenarios.length; i++) {
      if (DATA.scenarios[i].id === id) return DATA.scenarios[i];
    }
    return DATA.scenarios[0];
  }
  function scenarioForToday() {
    return scenarioById(CYCLE[dayIndex() % CYCLE.length]);
  }
  function dayRecord(key) {
    key = key || todayKey();
    if (!state.days[key]) state.days[key] = { scenarioId: scenarioForToday().id, stages: {}, minutes: 0 };
    return state.days[key];
  }
  function stageDone(stage) { return !!dayRecord().stages[stage]; }
  function markStage(stage, minutes) {
    var rec = dayRecord();
    if (!rec.stages[stage]) {
      rec.stages[stage] = true;
      var add = Math.max(1, Math.round(minutes || 0));
      rec.minutes = (rec.minutes || 0) + add;
      rec.byStage = rec.byStage || {};
      rec.byStage[stage] = (rec.byStage[stage] || 0) + add;
      save();
    }
  }
  function allStagesDone() {
    var rec = dayRecord();
    return !!(rec.stages.shadow && rec.stages.patterns && rec.stages.words && rec.stages.output);
  }
  function streak() {
    var n = 0, cursor = todayKey();
    // 今天没做也允许从昨天开始算，但今天做了要计入
    if (!hasAnyDone(cursor)) cursor = addDays(cursor, -1);
    while (hasAnyDone(cursor)) { n++; cursor = addDays(cursor, -1); }
    return n;
  }
  function hasAnyDone(key) {
    var r = state.days[key];
    return !!(r && r.stages && Object.keys(r.stages).some(function (k) { return r.stages[k]; }));
  }

  /* ---------------- 单词 SRS ---------------- */
  function wordKey(scenarioId, en) { return scenarioId + "|" + en; }

  // 所有可学词条的索引：场景词（A1）+ 词包（A2/B1）+ 自定义词库
  var REGISTRY = [];

  function rebuildRegistry() {
    var list = [];
    DATA.scenarios.forEach(function (sc) {
      sc.words.forEach(function (w) {
        list.push({ key: wordKey(sc.id, w.en), en: w.en, zh: w.zh, ex: w.ex,
          groupId: sc.id, groupTitle: sc.title, level: "A1" });
      });
    });
    PACKS.forEach(function (pk) {
      pk.words.forEach(function (w) {
        list.push({ key: "pack:" + pk.id + "|" + w.en, en: w.en, zh: w.zh, ex: w.ex,
          groupId: pk.id, groupTitle: pk.title, level: pk.level });
      });
    });
    (state.customPacks || []).forEach(function (cp) {
      cp.words.forEach(function (w) {
        list.push({ key: "custom:" + cp.id + "|" + w.en, en: w.en, zh: w.zh, ex: w.ex || "",
          ipa: w.ipa || "", groupId: cp.id, groupTitle: cp.name, level: "自定义" });
      });
    });
    CORE.forEach(function (b) {
      (b.words || []).forEach(function (row) {
        var en = row[0], zh = row[1], ex = row[2] || "";
        list.push({ key: "core:" + b.id + "|" + en, en: en, zh: zh, ex: ex,
          groupId: b.id, groupTitle: b.title, level: "高频" });
      });
    });
    REGISTRY = list;
  }
  rebuildRegistry();
  var openSections = {};
  var openGroups = {};

  function focusGroup(kind, id, title) {
    var items = REGISTRY.filter(function (it) { return it.groupId === id; });
    if (!items.length) { toast("这个组里没有词"); return; }
    state.focus = { kind: kind, id: id, title: title, at: todayKey() };
    save();
    go("today");
    toast("已设为今日学习：" + title + "（" + items.length + " 词）");
  }

  function startFocusSession() {
    if (!state.focus) return;
    var items = REGISTRY.filter(function (it) { return it.groupId === state.focus.id; });
    if (!items.length) return;
    activeStage = "focus";
    session.start = Date.now();
    session.stage = null;
    runWords(items.map(function (it) { return { key: it.key, word: it, isNew: !state.srs[it.key] }; }),
      "\u8bcd\u5e93\u5b66\u4e60", items.length + " \u5f20\u5361 \u00b7 \u5b66\u5b8c\u81ea\u52a8\u6392\u590d\u4e60", null,
      '<h2>' + esc(state.focus.title) + '</h2>', "focus");
  }

  /* 随机练习：从学过的词里随机抽 30 个 */
  function startRandomDrill() {
    var pool = [];
    REGISTRY.forEach(function (it) {
      if (state.srs[it.key]) pool.push(it);
    });
    if (!pool.length) { toast("还没有学过的单词，先去学几个"); return; }
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    var items = pool.slice(0, Math.min(30, pool.length));
    activeStage = "random";
    session.start = Date.now();
    session.stage = null;
    runWords(items.map(function (it) { return { key: it.key, word: it, isNew: false }; }),
      "随机练习", items.length + " 个词 · 从学过的词里随机抽", null,
      '<h2>随机练习（' + items.length + ' 个）</h2>', "random");
    viewScroll["review"] = 0;
    setActiveTab("review");
  }

  /* 专项练习：只练待巩固里的词和句型，认识后自动移出 */
  function startWeakDrill() {
    var wl = weakList();
    if (!wl.length) { toast("待巩固是空的"); return; }
    activeStage = "weak";
    session.start = Date.now();
    session.stage = null;
    runWords(wl.map(function (w) {
        return { key: w.key, word: w.word, isNew: false, kind: w.kind };
      }), "专项练习", wl.length + " 项 · 认识后自动消失", null,
      '<h2>专项练习（' + wl.length + ' 项）</h2>', "weak");
    viewScroll["review"] = 0;
    setActiveTab("review");
  }

  function dueWords() {
    var t = todayKey(), out = [];
    REGISTRY.forEach(function (item) {
      var rec = state.srs[item.key];
      if (rec && rec.done) return;
      if (rec && rec.due && rec.due <= t) out.push({ key: item.key, word: item, item: rec });
    });
    return out;
  }
  function newWordsOf(ownerId, limit) {
    var out = [];
    REGISTRY.forEach(function (item) {
      if (item.groupId !== ownerId) return;
      if (state.srs[item.key]) return;
      out.push(item);
    });
    return out.slice(0, limit || 25);
  }
  function markWeak(q, grade) {
    state.weak = state.weak || {};
    if (grade === 2) {
      if (state.weak[q.key]) {
        delete state.weak[q.key];
        toast("已从待巩固移除");
      }
    } else {
      var rec = state.weak[q.key] || { en: q.word.en, zh: q.word.zh, ex: q.word.ex || "", count: 0 };
      rec.en = q.word.en;
      rec.zh = q.word.zh;
      rec.ex = q.word.ex || "";
      rec.type = q.kind === "pattern" ? "pattern" : "word";
      rec.count = (rec.count || 0) + 1;
      rec.at = todayKey();
      state.weak[q.key] = rec;
    }
    save();
  }

  /* 手动移出待巩固：当作已掌握，往后推复习日期 */
  function markKnown(key) {
    if (String(key).indexOf("pattern:") === 0) {
      state.patterns[String(key).replace(/^pattern:/, "")] = todayKey();
      return;
    }
    var rec = state.srs[key] || { box: 0, due: todayKey(), seen: 0, lapses: 0 };
    rec.box = Math.max(rec.box || 0, 2);
    rec.done = true;
    rec.due = addDays(todayKey(), BOX_DAYS[Math.min(rec.box, BOX_DAYS.length - 1)]);
    rec.last = todayKey();
    state.srs[key] = rec;
  }

  function weakList() {
    var out = [];
    var w = state.weak || {};
    Object.keys(w).forEach(function (k) {
      var isPattern = k.indexOf("pattern:") === 0;
      var it = null;
      if (!isPattern) {
        REGISTRY.forEach(function (r) { if (r.key === k) it = r; });
      }
      out.push({
        key: k,
        kind: isPattern || w[k].type === "pattern" ? "pattern" : "word",
        word: it || { en: w[k].en, zh: w[k].zh, ex: w[k].ex || "" },
        rec: w[k]
      });
    });
    return out.reverse();
  }

  function reviewWord(key, grade) {
    var item = state.srs[key] || { box: 0, due: todayKey(), seen: 0, lapses: 0 };
    item.seen = (item.seen || 0) + 1;
    if (grade === 2) item.box = Math.min((item.box || 0) + 1, BOX_DAYS.length - 1);
    else if (grade === 1) item.box = item.box || 0;
    else { item.box = 0; item.lapses = (item.lapses || 0) + 1; }
    item.due = addDays(todayKey(), BOX_DAYS[item.box]);
    item.last = todayKey();
    state.srs[key] = item;
    save();
  }
  function coreWordCount() {
    var n = 0;
    CORE.forEach(function (b) { n += (b.words || []).length; });
    return n;
  }
  function learnedWordCount() { return Object.keys(state.srs).length; }

  /* ---------------- 语音合成 ---------------- */
  /* ---------------- 自然语音包（edge-tts 预生成，手机端用） ----------------
     桌面版直接走 Python 的 edge-tts；网页版/手机版从 audio/ 目录按需加载
     base64 mp3，播放效果和桌面版一致。加载失败自动回退系统 TTS。 */
  var PACK_VOICES = [
    { id: "aria", label: "女声 · Aria", desc: "温暖自然，推荐", edge: "en-US-AriaNeural" },
    { id: "guy", label: "男声 · Guy", desc: "沉稳清晰", edge: "en-US-GuyNeural" }
  ];

  var audioPack = {
    meta: null,          // { "0000abcd": [offset, length], ... }
    voice: "aria",
    base: "audio/",
    ready: false,
    blobCache: {},       // key -> objectURL（避免重复解码）
    inflight: {},
    player: null,
    MAX_BLOB: 60,

    hash: function (s) {
      var h = 5381;
      for (var i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) & 0xFFFFFFFF;
      }
      return h >>> 0;
    },
    hex8: function (n) {
      var s = (n >>> 0).toString(16);
      while (s.length < 8) s = "0" + s;
      return s;
    },

    init: function () {
      if (location.protocol === "file:") return;
      this.setVoice(state.settings.packVoice || "aria", true);
    },

    setVoice: function (voice, silent) {
      var self = this;
      if (["aria", "guy"].indexOf(voice) < 0) voice = "aria";
      this.voice = voice;
      this.meta = null;
      this.ready = false;
      this.blobCache = {};
      this.inflight = {};
      this.stop();
      var url = this.base + voice + ".json";
      var lsKey = "es.audioIdx2." + voice;

      try {
        var cached = localStorage.getItem(lsKey);
        if (cached) {
          var cm = JSON.parse(cached);
          if (cm && cm.__v && Object.keys(cm).length > 10) {
            delete cm.__v;
            this.meta = cm;
            this.ready = true;
            return Promise.resolve(true);
          }
        }
      } catch (e) {}

      return fetch(url, { cache: "force-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) {
          if (!m) {
            if (!silent) toast("这个音色包还没准备好");
            return false;
          }
          self.meta = m;
          self.ready = true;
          try {
            var toSave = {};
            for (var k in m) toSave[k] = m[k];
            toSave.__v = 1;
            localStorage.setItem(lsKey, JSON.stringify(toSave));
          } catch (e) {}
          return true;
        })
        .catch(function () { return false; });
    },

    // 桌面版：Python 直接读本地包片段（最快，通常 <10ms）
    _desktopApi: function () {
      return (window.pywebview && window.pywebview.api && window.pywebview.api.audio)
        ? window.pywebview.api : null;
    },

    _cachePut: function (key, url) {
      this.blobCache[key] = url;
      var keys = Object.keys(this.blobCache);
      if (keys.length > this.MAX_BLOB) {
        var old = this.blobCache[keys[0]];
        if (old && old.indexOf("blob:") === 0) URL.revokeObjectURL(old);
        delete this.blobCache[keys[0]];
      }
    },

    // 统一入口：text → 可播放的 URL
    loadAudioByText: function (text) {
      var self = this;
      var key = this.hex8(this.hash(text));
      if (this.blobCache[key]) return Promise.resolve(this.blobCache[key]);
      if (this.inflight[key]) return this.inflight[key];

      var p;
      var api = this._desktopApi();

      if (api) {
        // 桌面版：本地文件直读
        p = api.audio(text, this.voice).then(function (res) {
          if (!res || !res.ok || !res.audio) return null;
          var url = "data:audio/mpeg;base64," + res.audio;
          self._cachePut(key, url);
          delete self.inflight[key];
          return url;
        }).catch(function () { delete self.inflight[key]; return null; });
      } else {
        var meta = this.meta && this.meta[key];
        if (!meta) return Promise.resolve(null);
        var shard = meta[0], startOff = meta[1], len = meta[2];
        p = fetch(this.base + this.voice + "-" + shard + ".bin", {
          headers: { Range: "bytes=" + startOff + "-" + (startOff + len - 1) },
          cache: "force-cache"
        })
          .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
          .then(function (buf) {
            if (!buf || !buf.byteLength) return null;
            var objUrl = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
            self._cachePut(key, objUrl);
            delete self.inflight[key];
            return objUrl;
          })
          .catch(function () { delete self.inflight[key]; return null; });
      }

      this.inflight[key] = p;
      return p;
    },

    // 向后兼容：按 hash key 取
    loadAudio: function (key) {
      var self = this;
      if (this.blobCache[key]) return Promise.resolve(this.blobCache[key]);
      if (this.inflight[key]) return this.inflight[key];
      var api = this._desktopApi();
      if (api) return Promise.resolve(null);
      var meta = this.meta && this.meta[key];
      if (!meta) return Promise.resolve(null);
      var shard = meta[0], startOff = meta[1], len = meta[2];
      var p = fetch(this.base + this.voice + "-" + shard + ".bin", {
        headers: { Range: "bytes=" + startOff + "-" + (startOff + len - 1) },
        cache: "force-cache"
      })
        .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (buf) {
          if (!buf || !buf.byteLength) return null;
          var objUrl = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
          self._cachePut(key, objUrl);
          delete self.inflight[key];
          return objUrl;
        })
        .catch(function () { delete self.inflight[key]; return null; });
      this.inflight[key] = p;
      return p;
    },

    // 批量预取：并发拉取一小段 Range，进卡片页时就把这一组词下好
    preload: function (texts, concurrency) {
      var self = this;
      if (!this.ready || !texts || !texts.length) return Promise.resolve(0);
      var list = texts.filter(function (t) { return t && !self.blobCache[self.hex8(self.hash(t))]; });
      if (!list.length) return Promise.resolve(0);

      var n = 0, idx = 0, limit = concurrency || 6;
      return new Promise(function (resolve) {
        function next() {
          if (idx >= list.length) return;
          var t = list[idx++];
          self.loadAudioByText(t).then(function (u) {
            if (u) n++;
            if (idx < list.length) next(); else resolve(n);
          }).catch(function () { resolve(n); });
        }
        for (var i = 0; i < Math.min(limit, list.length); i++) next();
      });
    },

    // 正在播的词后面几张，提前取好（滑动/翻页时无感）
    prefetchAhead: function (queue, fromPos, count) {
      if (!this.ready || !queue) return;
      var list = [];
      for (var i = fromPos; i < Math.min(queue.length, fromPos + (count || 4)); i++) {
        var q = queue[i];
        if (q && q.word && q.word.en) list.push(q.word.en);
      }
      if (list.length) this.preload(list, 4);
    },

    stop: function () {
      if (this.player) { try { this.player.pause(); } catch (e) {} }
    },

    play: function (text, opts, done) {
      var self = this;
      opts = opts || {};
      var key = this.hex8(this.hash(text));

      function start(objUrl) {
        if (!objUrl) { done(false); return; }
        if (!self.player) self.player = new Audio();
        var a = self.player;
        try { a.pause(); } catch (e) {}
        a.src = objUrl;
        a.playbackRate = opts.rate || 1;
        a.onended = function () { if (opts.onend) opts.onend(); };
        a.onerror = function () { done(false); };
        var pr = a.play();
        if (pr && pr.catch) pr.catch(function () { done(false); });
        else done(true);
      }

      this.loadAudioByText(text).then(start).catch(function () { done(false); });
    }
  };

  var tts = {
    voices: [],
    ready: false,
    _last: { text: "", at: 0 },
    init: function () {
      if (!("speechSynthesis" in window)) return;
      var self = this;
      function load() {
        var all = window.speechSynthesis.getVoices() || [];
        self.voices = all.filter(function (v) { return /^en/i.test(v.lang); });
        self.ready = self.voices.length > 0;
        if (self.ready) document.dispatchEvent(new CustomEvent("tts-ready"));
      }
      load();
      window.speechSynthesis.onvoiceschanged = load;
    },
    // 微软的在线自然语音名字里带 Online (Natural)
    isNatural: function (v) { return /natural|online|neural/i.test(v.name || ""); },
    score: function (v) {
      var s = 0;
      if (this.isNatural(v)) s += 100;
      var pref = state.settings.accent || "en-US";
      var lang = String(v.lang || "").toLowerCase();
      if (pref !== "any") {
        if (lang.indexOf(pref.toLowerCase()) === 0) s += 40;
        else s -= 25;
      }
      if (/en-us/i.test(lang)) s += 6;
      if (!v.localService) s += 3;
      return s;
    },
    sorted: function () {
      var self = this;
      return this.voices.slice().sort(function (a, b) { return self.score(b) - self.score(a); });
    },
    naturalCount: function () {
      return this.voices.filter(this.isNatural.bind(this)).length;
    },
    pick: function () {
      var uri = state.settings.voiceURI;
      if (uri) {
        for (var i = 0; i < this.voices.length; i++) if (this.voices[i].voiceURI === uri) return this.voices[i];
      }
      return this.sorted()[0] || null;
    },
    speak: function (text, opts) {
      opts = opts || {};
      var raw = String(text == null ? "" : text);
      // 句型里的 ___ / ____ 是占位符，读成 blank，免得合成器念下划线
      var spoken = raw.replace(/_{2,}/g, "blank").replace(/\s+/g, " ").trim();
      if (!spoken) return;
      // 同一句 700ms 内重复触发（连点）只播一次
      var now = Date.now();
      if (spoken === this._last.text && now - this._last.at < 700) return;
      this._last = { text: spoken, at: now };

      // 桌面版：Aria 音色优先用 exe 内置音频包（瞬间出声），其他音色走 edge-tts
      if (window.pywebview && window.pywebview.api && window.pywebview.api.speak && window.DesktopSpeech) {
        var dv = state.settings.edgeVoice || "en-US-AriaNeural";
        if (dv === "en-US-AriaNeural" && audioPack.ready && audioPack.voice === "aria") {
          audioPack.stop();
          audioPack.play(spoken, opts, function (ok) {
            if (!ok) {
              opts.voice = dv;
              window.DesktopSpeech.speak(spoken, opts);
            }
          });
          return;
        }
        opts.voice = dv;
        window.DesktopSpeech.speak(spoken, opts);
        return;
      }

      var self = this;

      // 网页版 / 手机版：优先播放预生成的自然语音包，失败再回退系统 TTS
      if (audioPack.ready && !opts.systemOnly) {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        audioPack.stop();
        audioPack.play(spoken, opts, function (ok) {
          if (!ok) self._speakSystem(spoken, opts);
        });
        return;
      }

      this._speakSystem(spoken, opts);
    },

    // 系统 TTS（保底）
    _speakSystem: function (spoken, opts) {
      opts = opts || {};
      if (!("speechSynthesis" in window)) { toast("这个浏览器不支持语音合成"); return; }
      var self = this;
      window.speechSynthesis.cancel();
      var voice = this.pick();
      var triedFallback = false;

      function run(v) {
        var u = new SpeechSynthesisUtterance(spoken);
        if (v) u.voice = v;
        u.lang = (v && v.lang) || "en-US";
        u.rate = opts.rate || state.settings.rate || 1.0;
        u.pitch = 1;
        if (opts.onstart) u.onstart = opts.onstart;
        if (opts.onend) u.onend = opts.onend;
        u.onerror = function (e) {
          // 在线自然语音失败（多半是网络）→ 退回本地语音，保证还能读
          if (!triedFallback && v && self.isNatural(v)) {
            triedFallback = true;
            var local = self.voices.filter(function (x) { return !self.isNatural(x); })
              .sort(function (a, b) { return self.score(b) - self.score(a); })[0];
            if (local) { run(local); return; }
          }
          if (opts.onerror) opts.onerror(e);
        };
        window.speechSynthesis.speak(u);
      }
      run(voice);
    },
    stop: function () {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      audioPack.stop();
    }
  };

  /* ---------------- AI 批改（写作） ----------------
     Key 只存在本机 localStorage，浏览器直接调 API，不经过任何中间服务器。 */
  var AI_PROVIDERS = {
    deepseek: {
      label: "DeepSeek",
      url: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      hint: "去 platform.deepseek.com 注册 → API keys 创建，形如 sk-xxxx"
    },
    ark: {
      label: "火山方舟（豆包）",
      url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      model: "doubao-seed-2-1-turbo-260628",
      // 主模型 404 时依次尝试（换账号时自动适配）
      fallback: [
        "doubao-seed-2-1-turbo-260628",
        "doubao-seed-2-1-turbo",
        "doubao-seed-2-1-pro-260915",
        "doubao-seed-2-1-lite-260915",
        "doubao-seed-2-0-mini-260428",
        "doubao-seed-1-6-250615"
      ],
      hint: "去 console.volcengine.com/ark 创建 API Key，粘贴即可。"
    }
  };

  var AI = {
    providerId: function () {
      var id = state.settings.aiProvider;
      return AI_PROVIDERS[id] ? id : "deepseek";
    },
    provider: function () {
      return AI_PROVIDERS[this.providerId()];
    },
    configured: function () {
      return !!(state.settings.aiKey && String(state.settings.aiKey).trim());
    },

    // 单次调用；模型 404 时按 fallback 列表自动重试
    _once: function (model, userPrompt, stream) {
      var self = this;
      var prov = this.provider();
      var list = [];
      if (model) list.push(model);
      (prov.fallback || []).forEach(function (m) { if (list.indexOf(m) < 0) list.push(m); });
      if (!list.length) list.push(prov.model);

      function tryNext(i) {
        if (i >= list.length) {
          var err = new Error("没有可用模型");
          err.code = 404;
          err.detail = "试过：" + list.join(", ");
          return Promise.reject(err);
        }
        return self._onceRaw(list[i], userPrompt).catch(function (e) {
          // 404 / 403 = 这个模型没开通，试下一个
          if (e.code === 404 || e.code === 403) return tryNext(i + 1);
          throw e;
        });
      }
      return tryNext(0);
    },

    // 真正发请求
    _onceRaw: function (model, userPrompt) {
      var prov = this.provider();
      var key = String(state.settings.aiKey || "").trim();
      var body = {
        model: model,
        messages: [
          { role: "system", content: "你是一位耐心的英语老师。" },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        stream: false
      };
      return fetch(prov.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var err = new Error("HTTP " + r.status);
            err.code = r.status;
            err.detail = String(t).slice(0, 200);
            throw err;
          });
        }
        return r.json().then(function (d) {
          var out = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
          return { ok: true, model: model, text: out };
        });
      });
    },

    chat: function (userPrompt, onProgress) {
      var prov = this.provider();
      var key = String(state.settings.aiKey || "").trim();
      if (!key) return Promise.reject(new Error("还没有填写 API Key"));
      var model = String(state.settings.aiModel || prov.model || "").trim() || prov.model;

      var body = {
        model: model,
        messages: [
          { role: "system", content: "你是一位耐心、简洁的英语老师，批改对象是中文母语的 A0–A1 初学者。用中文解释，例子用英文。" },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        stream: !!onProgress
      };

      return fetch(prov.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("HTTP " + res.status + "：" + String(t).slice(0, 160));
          });
        }
        if (!onProgress) {
          return res.json().then(function (d) {
            return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
          });
        }
        // 流式读取
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = "", full = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return full;
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            lines.forEach(function (ln) {
              ln = ln.trim();
              if (!ln || ln.indexOf("data:") !== 0) return;
              var payload = ln.slice(5).trim();
              if (payload === "[DONE]") return;
              try {
                var j = JSON.parse(payload);
                var d = j.choices && j.choices[0] && j.choices[0].delta;
                if (d && d.content) {
                  full += d.content;
                  if (onProgress) onProgress(full);
                }
              } catch (e) {}
            });
            return pump();
          });
        }
        return pump();
      });
    }
  };

  /* ---------------- 词汇提示 / 拼写检查 ---------------- */
  var CHECKER = window.ENGLISH_CHECKER || null;
  var LOOKUP = {};
  REGISTRY.forEach(function (w) {
    var k = String(w.en).toLowerCase();
    if (!LOOKUP[k]) LOOKUP[k] = { zh: w.zh, ex: w.ex || "" };
  });
  var DICT = CHECKER
    ? CHECKER.buildDict((window.COMMON_WORDS || []).concat(REGISTRY.map(function (w) { return w.en; })))
    : {};

  function lookupWord(w) { return LOOKUP[String(w).toLowerCase()] || null; }

  function annotate(text) {
    if (!CHECKER) return esc(text);
    return CHECKER.annotate(text, lookupWord, esc);
  }

  function initTooltip() {
    var tip = document.createElement("div");
    tip.className = "wordtip";
    document.body.appendChild(tip);
    var current = null;
    function show(el) {
      var info = lookupWord(el.dataset.w);
      if (!info) return;
      current = el;
      tip.innerHTML = '<div class="wt-en">' + esc(el.dataset.w) + "</div>" +
        '<div class="wt-zh">' + esc(info.zh) + "</div>" +
        (info.ex ? '<div class="wt-ex">' + esc(info.ex) + "</div>" : "");
      var r = el.getBoundingClientRect();
      var left = Math.min(window.innerWidth - 250, Math.max(8, r.left));
      tip.style.left = left + "px";
      tip.style.top = (r.bottom + window.scrollY + 8) + "px";
      tip.classList.add("show");
    }
    function hide() { tip.classList.remove("show"); current = null; }
    function target(e) {
      var n = e.target;
      return (n && n.closest) ? n.closest(".wt") : null;
    }
    document.addEventListener("mouseover", function (e) { var el = target(e); if (el) show(el); });
    document.addEventListener("mouseout", function (e) { var el = target(e); if (el && el === current) hide(); });
    document.addEventListener("focusin", function (e) { var el = target(e); if (el) show(el); });
    document.addEventListener("click", function (e) {
      var el = target(e);
      if (el) { show(el); tts.speak(el.dataset.w); }
    });
    document.addEventListener("scroll", hide, true);
  }

  /* ---------------- 主题 ---------------- */
  var THEMES = [
    { id: "system", label: "跟随系统" },
    { id: "dark", label: "深色" },
    { id: "light", label: "浅色" }
  ];

  function resolveTheme() {
    var q = /[?&]theme=(dark|light)/.exec(location.search || "");
    if (q) return q[1];
    var t = state.settings.theme || "system";
    if (t === "system") {
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    return t;
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", resolveTheme());
  }

  /* ---------------- 字号 ---------------- */
  var FONT_SCALES = [
    { id: "normal", label: "普通" },
    { id: "large", label: "大" },
    { id: "xlarge", label: "特大" }
  ];

  function applyFontScale() {
    var v = state.settings.fontScale || "normal";
    document.documentElement.setAttribute("data-fs", v);
  }

  /* ---------------- 路由 ---------------- */
  var VIEWS = ["today", "review", "words", "dictation", "speaking", "writing", "exam", "grammar", "stats", "settings"];
  var viewScroll = {};
  var activeStage = null;
  var currentSessKey = null;

  // 手机上标签栏可横向滚动：平滑地把当前栏目居中，避免瞬间跳位造成的抖动
  var tabScrollRaf = 0;
  function animateTabScroll(tabsEl, to, dur) {
    var from = tabsEl.scrollLeft;
    if (Math.abs(to - from) < 1) return;
    if (tabScrollRaf) { cancelAnimationFrame(tabScrollRaf); tabScrollRaf = 0; }
    var startTs = 0;
    dur = dur || 240;
    function step(ts) {
      if (!startTs) startTs = ts;
      var t = Math.min(1, (ts - startTs) / dur);
      var e = 1 - Math.pow(1 - t, 3);          // easeOutCubic
      tabsEl.scrollLeft = from + (to - from) * e;
      if (t < 1) tabScrollRaf = requestAnimationFrame(step);
      else tabScrollRaf = 0;
    }
    tabScrollRaf = requestAnimationFrame(step);
    // 兜底：某些环境 rAF 不推进时，稍后直接对齐
    setTimeout(function () {
      if (Math.abs(tabsEl.scrollLeft - to) > 1.5) tabsEl.scrollLeft = to;
    }, dur + 80);
  }

  function scrollTabIntoView(view, onlyIfHidden) {
    var tabsEl = document.querySelector(".tabs");
    var act = document.querySelector('.tab[data-view="' + view + '"]');
    if (!tabsEl || !act) return;
    if (tabsEl.scrollWidth <= tabsEl.clientWidth + 4) return;
    // 用 rect 算相对位移，offsetLeft 的参照系不可靠
    var ar = act.getBoundingClientRect();
    var tr = tabsEl.getBoundingClientRect();
    // 点击标签时：目标本来就在可视区，不必再滚，避免「标签栏自己动一下」
    if (onlyIfHidden && ar.left >= tr.left - 1 && ar.right <= tr.right + 1) return;
    var delta = (ar.left - tr.left) - (tabsEl.clientWidth - ar.width) / 2;
    var target = tabsEl.scrollLeft + delta;
    var max = tabsEl.scrollWidth - tabsEl.clientWidth;
    if (target < 0) target = 0;
    if (target > max) target = max;
    animateTabScroll(tabsEl, target, 240);
  }

  function setActiveTab(view) {
    $$(".tab").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
  }

  function currentView() {
    var el = $$(".tab.active")[0];
    return el ? el.dataset.view : null;
  }

  var viewEnterDir = 0;   // 1 = 从右进入，-1 = 从左进入

  function go(view, keepTabStill) {
    document.onkeydown = null;
    var mainEl = document.querySelector("main");
    var cur = currentView();
    if (cur && mainEl) viewScroll[cur] = mainEl.scrollTop || 0;

    // 1) 先归零滚动：否则旧的 scrollTop 会作用到新页上，触发重排
    if (mainEl) mainEl.scrollTop = 0;

    // 2) 先在「隐藏状态」把目标页渲染好。
    //    如果先切换显示再渲染，中间会露出一帧空白/旧内容，表现为整屏闪一下。
    if (view === "today") {
      if (activeStage) openStage(activeStage, true);
      else renderToday();
    }
    if (view === "review") renderReview();
    if (view === "words") renderWords();
    if (view === "dictation") renderDictation();
    if (view === "grammar") renderGrammar();
    if (view === "exam") renderExam();
    if (view === "writing") renderWriting();
    if (view === "speaking") renderSpeaking();
    if (view === "stats") renderStats();
    if (view === "settings") renderSettings();

    // 3) 内容就绪后，同一帧内切换显示
    VIEWS.forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (!el) return;
      el.classList.toggle("hidden", v !== view);
      el.classList.remove("enter-right", "enter-left");
      if (v === view && viewEnterDir) {
        void el.offsetWidth;
        el.classList.add(viewEnterDir > 0 ? "enter-right" : "enter-left");
      }
    });
    viewEnterDir = 0;

    // 4) 标签高亮 + 标签栏跟随（点击已可见的标签时不滚动）
    $$(".tab").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    scrollTabIntoView(view, !!keepTabStill);

    // 5) 始终从顶部开始，不做滚动恢复，避免「先显示顶部再跳回去」
    if (mainEl) mainEl.scrollTop = 0;
    tts.stop();
  }

  /* ---------------- 手机端：左右滑动切换栏目 ---------------- */
  /* 边缘手势：优先在子会话里前进/后退；没有会话时切栏目 */
  function doEdgeBack() {
    var back = document.getElementById("back-today");
    if (back) { tts.stop(); back.click(); return true; }
    // 没有子会话 → 切到上一个栏目
    var i = VIEWS.indexOf(currentView());
    if (i > 0) { go(VIEWS[i - 1]); return true; }
    return false;
  }

  function doEdgeForward() {
    var fin = document.getElementById("finish-stage");
    if (fin) { fin.click(); return true; }
    // 没有子会话 → 切到下一个栏目
    var i = VIEWS.indexOf(currentView());
    if (i >= 0 && i < VIEWS.length - 1) { go(VIEWS[i + 1]); return true; }
    return false;
  }

  function initSwipe() {
    if (!window.matchMedia || !window.matchMedia("(max-width: 820px)").matches) return;

    var el = document.querySelector("main");
    if (!el) return;

    var LOCK = 4;          // 判定横向的位移阈值（px）
    var COMMIT_DIST = 20;  // 松手按位移切页
    var COMMIT_VEL = 90;   // 松手按速度切页（px/s）
    var RUBBER = 0.3;      // 到边界的阻尼

    // 各视图的渲染函数（用于按需渲染目标页）
    var RENDER = {
      today: function () { renderToday(); },
      review: function () { renderReview(); },
      words: function () { renderWords(); },
      dictation: function () { renderDictation(); },
      grammar: function () { renderGrammar(); },
      exam: function () { renderExam(); },
      writing: function () { renderWriting(); },
      speaking: function () { renderSpeaking(); },
      stats: function () { renderStats(); },
      settings: function () { renderSettings(); }
    };

    var startX = 0, startY = 0, startT = 0;
    var lastX = 0, lastT = 0;
    var vx = 0, peakVel = 0;
    var tracking = false, locked = false, vertical = false;
    var edgeFrom = "";     // 边缘手势起手位置："left" / "right" / ""
    var curEl = null;      // 当前页
    var tgtEl = null;      // 目标页（跟着一起滑）
    var offset = 0;
    var pendingDx = 0;

    function idx() { return VIEWS.indexOf(currentView()); }
    function canGo(dirSign) {
      var i = idx();
      if (i < 0) return false;
      var n = dirSign < 0 ? i + 1 : i - 1;
      return n >= 0 && n < VIEWS.length;
    }
    function targetView(dirSign) {
      var i = idx();
      var n = dirSign < 0 ? i + 1 : i - 1;
      return (n >= 0 && n < VIEWS.length) ? VIEWS[n] : null;
    }

    // 只排除真正的输入控件与显式 no-swipe
    function inField(target) {
      var n = target;
      while (n && n !== document.body && n !== el) {
        if (n.nodeType === 1) {
          var tag = n.tagName;
          if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
          if (n.getAttribute && n.getAttribute("data-no-swipe") !== null) return true;
        }
        n = n.parentElement;
      }
      return false;
    }

    function apply(dx) {
      pendingDx = dx;
      if (!curEl) return;
      curEl.style.transform = dx ? "translate3d(" + dx + "px,0,0)" : "";
      if (tgtEl) {
        var W = window.innerWidth || 380;
        var sign = offsetSign < 0 ? 1 : -1;
        tgtEl.style.transform = "translate3d(" + (dx + W * sign) + "px,0,0)";
      }
    }

    var offsetSign = 0;   // -1 左滑（目标从右进） / 1 右滑（目标从左进）

    function clearInline(node) {
      if (!node) return;
      node.style.transition = "";
      node.style.transform = "";
      node.style.opacity = "";
      node.style.top = "";
      node.style.left = "";
      node.style.right = "";
      node.style.width = "";
      node.style.margin = "";
      node.style.position = "";
    }

    // 准备目标页：按需渲染 + 绝对定位到内容区
    function prepareTarget(dirSign) {
      var v = targetView(dirSign);
      if (!v) return null;
      var tEl = document.getElementById("view-" + v);
      if (!tEl) return null;
      if (!tEl.innerHTML.trim() && RENDER[v]) {
        RENDER[v]();      // 首次访问的栏目先渲染出真实内容
      }
      tEl.classList.remove("hidden");
      tEl.classList.add("swipe-target");
      // 直接对齐当前页的真实盒子（offset 不受 transform 影响），
      // 这样目标页与当前页位置/宽度完全一致，切换后不会跳
      if (curEl) {
        tEl.style.top = curEl.offsetTop + "px";
        tEl.style.left = curEl.offsetLeft + "px";
        tEl.style.width = curEl.offsetWidth + "px";
        tEl.style.right = "auto";
        tEl.style.margin = "0";
      } else {
        var cs = window.getComputedStyle(el);
        var pt = parseFloat(cs.paddingTop) || 0;
        var pl = parseFloat(cs.paddingLeft) || 0;
        tEl.style.top = pt + "px";
        tEl.style.left = pl + "px";
        tEl.style.right = pl + "px";
        tEl.style.margin = "0 auto";
      }
      tEl.style.transform = "translate3d(0,0,0)";
      return tEl;
    }

    function releaseTarget() {
      if (!tgtEl) return;
      tgtEl.classList.remove("swipe-target");
      clearInline(tgtEl);
      // 恢复：如果不是当前视图，重新隐藏
      if (tgtEl.id !== "view-" + currentView()) tgtEl.classList.add("hidden");
      tgtEl = null;
    }

    el.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      var t = e.touches[0];
      if (inField(e.target)) { tracking = false; return; }

      // 边缘手势：左边缘右滑 = 返回上一级，右边缘左滑 = 进入下一级
      var W = window.innerWidth || 380;
      var EDGE = 26;
      edgeFrom = t.clientX <= EDGE ? "left" : (t.clientX >= W - EDGE ? "right" : "");

      startX = lastX = t.clientX;
      startY = t.clientY;
      startT = lastT = performance.now();
      vx = 0; peakVel = 0; offset = 0; pendingDx = 0; offsetSign = 0;
      locked = false; vertical = false; tracking = true;
      curEl = document.getElementById("view-" + currentView());
      document.documentElement.classList.add("swiping-active");
    }, { passive: true });

    el.addEventListener("touchmove", function (e) {
      if (!tracking || vertical) return;
      if (edgeFrom) return;          // 边缘手势不改页面位移
      var t = e.touches[0];
      if (!t) return;

      var dx = t.clientX - startX;
      var dy = t.clientY - startY;

      if (!locked) {
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (ady > 12 && ady > adx * 1.6) {
          vertical = true; tracking = false; apply(0);
          document.documentElement.classList.remove("swiping-active");
          releaseTarget();
          return;
        }
        if (adx > LOCK && adx >= ady) {
          locked = true;
          offsetSign = dx < 0 ? -1 : 1;
          if (curEl) {
            curEl.style.transition = "none";
            curEl.style.willChange = "transform";
          }
          if (canGo(offsetSign)) {
            tgtEl = prepareTarget(offsetSign);
            if (tgtEl) tgtEl.style.transition = "none";
          }
        } else {
          return;
        }
      }

      var now = performance.now();
      var dt = now - lastT;
      if (dt > 0) {
        var inst = (t.clientX - lastX) / dt * 1000;
        vx = vx * 0.55 + inst * 0.45;
        if (Math.abs(inst) > Math.abs(peakVel)) peakVel = inst;
        lastX = t.clientX;
        lastT = now;
      }

      var d = dx;
      if ((dx < 0 && !canGo(-1)) || (dx > 0 && !canGo(1))) d = dx * RUBBER;

      offset = d;
      apply(d);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    function finish(e) {
      document.documentElement.classList.remove("swiping-active");
      if (!tracking && !locked) { clearInline(curEl); return; }
      var wasLocked = locked;
      var dx = offset;
      var speed = vx;
      var dur = performance.now() - startT;
      tracking = false; locked = false;

      if (!wasLocked) { clearInline(curEl); curEl = null; return; }

      var dist = Math.abs(dx);
      var vBest = Math.abs(peakVel) > Math.abs(speed) ? peakVel : speed;
      // 位移太小时不认速度，避免轻点/微动误切页
      var MIN_SPEED_DIST = 10;
      var fast = Math.abs(vBest) > COMMIT_VEL && dist >= MIN_SPEED_DIST;
      var far = dist > COMMIT_DIST;
      var sign = dist > 3 ? Math.sign(dx) : Math.sign(vBest);

      var dir = 0;
      if ((far || fast) && sign !== 0 && canGo(sign) && dur < 1200) dir = sign;

      var from = curEl;
      var to = tgtEl;
      curEl = null; tgtEl = null;

      var W = window.innerWidth || 380;

      if (!dir) {
        // 弹回：两页一起回到原位
        if (from) {
          from.style.transition = "transform .26s cubic-bezier(.2,.8,.3,1)";
          from.style.transform = "";
        }
        if (to) {
          to.style.transition = "transform .26s cubic-bezier(.2,.8,.3,1)";
          var sgn = offsetSign < 0 ? 1 : -1;
          to.style.transform = "translate3d(" + (W * sgn) + "px,0,0)";
        }
        setTimeout(function () {
          clearInline(from);
          if (to) { to.classList.remove("swipe-target"); clearInline(to); to.classList.add("hidden"); }
        }, 300);
        return;
      }

      // 切换：当前页滑出，目标页滑入，同步完成
      var dirSign = dir < 0 ? -1 : 1;
      if (from) {
        from.style.transition = "transform .3s cubic-bezier(.22,.68,.28,1)";
        from.style.transform = "translate3d(" + (dirSign < 0 ? -W : W) + "px,0,0)";
      }
      if (to) {
        to.style.transition = "transform .3s cubic-bezier(.22,.68,.28,1)";
        to.style.transform = "translate3d(0,0,0)";
      }

      var nextView = targetView(dirSign);
      setTimeout(function () {
        // 关键：先把滚动位置归零，再把目标页从绝对定位恢复成普通布局。
        // 否则清理瞬间内容会按旧滚动位置偏移，看起来「抖一下/往下移」。
        if (el) el.scrollTop = 0;
        if (from) clearInline(from);
        if (to) { to.classList.remove("swipe-target"); clearInline(to); }
        viewEnterDir = 0;      // 已手动完成过渡，不再播放额外动画
        if (nextView) {
          viewScroll[nextView] = 0;   // 新页从顶部开始
          go(nextView);
        }
      }, 290);
    }

    el.addEventListener("touchend", function (e) {
      if (edgeFrom) {
        var t = (e.changedTouches && e.changedTouches[0]) || null;
        var from = edgeFrom;
        edgeFrom = "";
        tracking = false;
        document.documentElement.classList.remove("swiping-active");
        if (!t) return;
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
        if (from === "left" && dx > 0) { doEdgeBack(); return; }
        if (from === "right" && dx < 0) { doEdgeForward(); return; }
        return;
      }
      finish();
    }, { passive: true });
    el.addEventListener("touchcancel", function () {
      document.documentElement.classList.remove("swiping-active");
      tracking = false; locked = false;
      if (curEl) {
        curEl.style.transition = "transform .26s cubic-bezier(.2,.8,.3,1)";
        curEl.style.transform = "";
        (function (n) { setTimeout(function () { clearInline(n); }, 300); })(curEl);
      }
      releaseTarget();
      curEl = null;
    }, { passive: true });
  }

  /* ---------------- 今日 ---------------- */
  function renderToday() {
    var sc = scenarioForToday();
    var rec = dayRecord();
    var stages = [
      { id: "shadow", name: "① 影子跟读", meta: "25 分钟 · 听 + 模仿语调", icon: "🎧" },
      { id: "patterns", name: "② 句型打磨", meta: "20 分钟 · 6 个万能句型", icon: "🧩" },
      { id: "words", name: "③ 场景单词", meta: "15 分钟 · 15 个词（含复习）", icon: "📒" },
      { id: "output", name: "④ 开口输出", meta: "20 分钟 · 角色扮演 + 造句", icon: "🗣️" }
    ];
    var doneCount = stages.filter(function (s) { return rec.stages[s.id]; }).length;
    var pct = Math.round(doneCount / stages.length * 100);
    var due = dueWords().length;

    var focusHtml = "";
    if (state.focus) {
      var fitems = REGISTRY.filter(function (it) { return it.groupId === state.focus.id; });
      if (fitems.length) {
        var fLearned = fitems.filter(function (it) { return state.srs[it.key]; }).length;
        var fNew = fitems.length - fLearned;
        focusHtml = '<div class="card focus-card">' +
          '<div class="focus-row">' +
            '<div class="focus-info">' +
              '<div class="tiny faint">今日词库</div>' +
              '<h2 style="margin:2px 0 4px">' + esc(state.focus.title) + '</h2>' +
              '<div class="small muted">共 ' + fitems.length + ' 词 · 待学习 ' + fNew + ' · 已学习 ' + fLearned + '</div>' +
            '</div>' +
            '<div class="focus-actions">' +
              '<button class="btn primary" id="focus-start">' + (fNew ? "开始学习" : "再复习一遍") + '</button>' +
            '</div>' +
          '</div>' +
          '</div>';
      } else {
        state.focus = null;
      }
    }

    // 温和提醒：今天还没开始 / 昨天断签
    // 首次使用（从来没有学过任何一天）不提示，避免新用户一进来就看到「断签」
    var banner = "";
    var today = todayKey();
    var hasHistory = Object.keys(state.days || {}).some(function (k) { return hasAnyDone(k); });
    if (hasHistory && state.settings.hideReminder !== today && !hasAnyDone(today)) {
      var y = addDays(today, -1);
      var msg = hasAnyDone(y)
        ? "今天还没开始，<b>10 分钟就够</b>。"
        : "昨天断了一下，没关系，<b>今天接上就行</b>。";
      banner = '<div class="card reminder" id="reminder">' +
        '<div class="row"><div style="flex:1">' + msg + '</div>' +
        '<button class="btn primary" id="reminder-go">开始</button>' +
        '<button class="btn ghost" id="reminder-hide">今天不再提示</button></div></div>';
    }

    var html = banner + "" +
      '<div class="card">' +
        '<div class="hero">' +
          '<div class="hero-icon">' + sc.icon + '</div>' +
          '<div class="hero-main">' +
            '<h1>' + esc(sc.title) + ' <span class="faint small">' + esc(sc.titleEn) + '</span></h1>' +
            '<div class="muted small">今天的目标：' + esc(sc.goal) + '</div>' +
          '</div>' +
          '<div class="hero-ring">' +
            '<div class="stat"><div class="num">' + doneCount + '/4</div><div class="lbl">今日进度</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="progress-line" style="margin-top:16px"><i style="width:' + pct + '%"></i></div>' +
        '<div class="stats-strip">' +
          '<div class="stat"><div class="num">' + streak() + '</div><div class="lbl">连续天数</div></div>' +
          '<div class="stat"><div class="num">' + learnedWordCount() + '</div><div class="lbl">已学单词</div></div>' +
          '<div class="stat"><div class="num">' + Object.keys(state.patterns).length + '</div><div class="lbl">掌握句型</div></div>' +
          '<div class="stat"><div class="num">' + due + '</div><div class="lbl">待复习</div></div>' +
          '<div class="stat"><div class="num">' + (rec.minutes || 0) + '</div><div class="lbl">今日分钟</div></div>' +
        '</div>' +
      '</div>' +
      focusHtml +

      '<div class="card">' +
        '<h2>今天的流程</h2>' +
        '<div class="faint small" style="margin-bottom:12px">顺序别乱：跟读 → 句型 → 单词 → 输出。每步做完点“完成本步”。</div>' +
        '<div class="stages">' +
          stages.map(function (s) {
            var done = !!rec.stages[s.id];
            return '<div class="stage' + (done ? " done" : "") + '" data-stage="' + s.id + '">' +
              '<div class="idx">' + (done ? "✓" : s.icon) + '</div>' +
              '<div class="body"><div class="name">' + s.name + '</div><div class="meta">' + s.meta + '</div></div>' +
              '<div class="go">' + (done ? "再做一次" : "开始") + ' →</div>' +
            '</div>';
          }).join("") +
          '<div class="stage' + (allStagesDone() ? " done" : "") + '" data-stage="retest">' +
            '<div class="idx">🏁</div>' +
            '<div class="body"><div class="name">⑤ 每日收尾</div><div class="meta">用 3 分钟自测今天的内容</div></div>' +
            '<div class="go">开始 →</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>给 A0 起步的三条提醒</h2>' +
        '<div class="small muted">1. 听不懂就点慢速（0.7×）再听一遍，不要看中文猜。' +
        '2. 跟读时不要逐词翻译，模仿语调比发音准不准更重要。' +
        '3. 输出阶段说错没关系，先让对方听懂——这是你自己的练习，不是考试。</div>' +
      '</div>';

    $("#view-today").innerHTML = html;
    $$("#view-today .stage").forEach(function (el) {
      el.addEventListener("click", function () { openStage(el.dataset.stage); });
    });

    var reminderGo = $("#reminder-go");
    if (reminderGo) reminderGo.addEventListener("click", function () {
      var next = stages.filter(function (s) { return !rec.stages[s.id]; })[0];
      openStage(next ? next.id : "retest");
    });
    var reminderHide = $("#reminder-hide");
    if (reminderHide) reminderHide.addEventListener("click", function () {
      state.settings.hideReminder = today;
      save();
      var el = $("#reminder");
      if (el) el.remove();
    });

    var fStart = $("#focus-start");
    if (fStart) fStart.addEventListener("click", function () { startFocusSession(); });
  }

  /* ---------------- 阶段容器 ---------------- */
  var session = { start: 0, stage: null };

  function openStage(stage, resume) {
    tts.stop();
    activeStage = stage;
    if (!resume) session.start = Date.now();
    session.stage = stage;
    if (stage === "shadow") renderShadow();
    else if (stage === "patterns") renderPatterns();
    else if (stage === "words") renderWordStage();
    else if (stage === "output") renderOutput();
    else if (stage === "retest") renderDailyQuiz();
    else if (stage === "focus") startFocusSession();
    else if (stage === "weak") startWeakDrill();
    else if (stage === "random") startRandomDrill();
    window.scrollTo(0, 0);
  }

  function sessionShell(title, subtitle, bodyHtml, stage) {
    var sc = scenarioForToday();
    $("#view-today").innerHTML =
      '<div class="session-head">' +
        '<button class="btn ghost" id="back-today">← 返回</button>' +
        '<div><div style="font-weight:600">' + esc(title) + '</div>' +
        '<div class="faint small">' + esc(subtitle) + '</div></div>' +
        '<div class="spacer"></div>' +
        '<div class="timer" id="stage-timer">00:00</div>' +
      '</div>' +
      '<div class="card session-body">' + bodyHtml + '</div>' +
      '<div class="row session-foot">' +
        '<button class="btn primary" id="finish-stage">完成本步</button>' +
        '<button class="btn ghost" id="skip-stage">跳过</button>' +
        '<div class="spacer"></div>' +
        '<span class="faint tiny">空格键 = 播放 / 翻面</span>' +
      '</div>';

    function backToParent(was) {
      currentSessKey = null;
      activeStage = null;
      if (was === "weak" || was === "random") {
        openSections["rv|weak"] = false;   // 回复习页时折叠区恢复收起
        viewScroll["review"] = 0;
        go("review");
        return;
      }
      go("today");
    }
    $("#back-today").addEventListener("click", function () {
      tts.stop();
      backToParent(currentSessKey);
    });
    $("#finish-stage").addEventListener("click", function () {
      var mins = (Date.now() - session.start) / 60000;
      var was = currentSessKey;
      if (stage) {
        markStage(stage, mins);
        toast("本步完成，已记录 " + Math.max(1, Math.round(mins)) + " 分钟");
      } else {
        toast("这一组过完了");
      }
      backToParent(was);
    });
    $("#skip-stage").addEventListener("click", function () {
      tts.stop();
      backToParent(currentSessKey);
    });

    var timerEl = $("#stage-timer");
    var iv = setInterval(function () {
      if (!document.getElementById("stage-timer")) { clearInterval(iv); return; }
      var s = Math.floor((Date.now() - session.start) / 1000);
      timerEl.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }

  /* ---------------- ① 跟读 ---------------- */
  function renderShadow() {
    var sc = scenarioForToday();
    var body =
      '<h2>① 影子跟读 <span class="faint small">25 分钟</span></h2>' +
      '<div class="small muted" style="margin-bottom:14px">' +
        '四遍法：① 盲听抓大意 → ② 看文本听、标出听不懂的 → ③ 滞后 0.5 秒跟着读 → ④ 脱稿跟读。' +
        '卡住就点 <b>0.7×</b> 慢速。' +
      '</div>' +
      '<div class="shadow-list">' +
        sc.shadow.map(function (s, i) {
          return '<div class="shadow-item" data-i="' + i + '">' +
            '<button class="play" data-play="' + i + '">▶</button>' +
            '<div style="flex:1"><div class="en">' + annotate(s.en) + '</div>' +
            ipaHtml(s.en, "sm") +
            '<div class="zh">' + esc(s.zh) + '</div></div>' +
            '<button class="play" data-slow="' + i + '" title="慢速 0.7×">0.7×</button>' +
            '<button class="play" data-rec="' + i + '" title="跟读录音">🎤</button>' +
          '</div>';
        }).join("") +
      '</div>';

    sessionShell("影子跟读", "今天：" + sc.title, body, "shadow");

    function play(i, slow) {
      var s = sc.shadow[i];
      $$(".shadow-item").forEach(function (el) { el.classList.remove("speaking"); });
      var row = $('.shadow-item[data-i="' + i + '"]');
      tts.speak(s.en, {
        rate: slow ? 0.6 : (state.settings.rate || 1.0),
        onstart: function () { if (row) row.classList.add("speaking"); },
        onend: function () { if (row) row.classList.remove("speaking"); }
      });
    }
    $$("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () { play(Number(b.dataset.play), false); });
    });
    $$("[data-slow]").forEach(function (b) {
      b.addEventListener("click", function () { play(Number(b.dataset.slow), true); });
    });

    /* 录音跟读：点一次开始，再点一次结束；结束后可回放、可与原音对比 */
    var recBtn = null;
    var recIndex = -1;
    var takes = {};   // i -> url

    function stopRecording() {
      if (!window.Recorder || !Recorder.isRecording()) return Promise.resolve(null);
      return Recorder.stop().then(function (res) {
        if (recBtn) { recBtn.textContent = "🎤"; recBtn.classList.remove("recording"); }
        recBtn = null;
        return res;
      }).catch(function (err) { toast(err.message); return null; });
    }

    function addTakeControls(i, url) {
      takes[i] = url;
      var row = $('.shadow-item[data-i="' + i + '"]');
      if (!row) return;
      if (row.querySelector(".take")) row.querySelector(".take").remove();
      var box = document.createElement("div");
      box.className = "take";
      box.style.cssText = "display:flex;gap:6px;margin-top:8px";
      var mine = document.createElement("button");
      mine.className = "btn tiny";
      mine.textContent = "▶ 我的录音";
      mine.addEventListener("click", function () { Recorder.play(url); });
      var cmp = document.createElement("button");
      cmp.className = "btn tiny";
      cmp.textContent = "⇄ 对比";
      cmp.addEventListener("click", function () {
        tts.speak(sc.shadow[i].en, {
          onend: function () { setTimeout(function () { Recorder.play(url); }, 400); }
        });
      });
      box.appendChild(mine);
      box.appendChild(cmp);
      row.querySelector("div").appendChild(box);
    }

    $$("[data-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.dataset.rec);
        if (Recorder.isRecording()) {
          stopRecording().then(function (res) {
            if (res) { addTakeControls(i, res.url); toast("录了 " + res.seconds + " 秒，可以回放对比"); }
          });
          return;
        }
        stopRecording().then(function () {
          Recorder.start().then(function () {
            recBtn = b; recIndex = i;
            b.textContent = "■";
            b.classList.add("recording");
            toast("开始录音，读完这句再点一次");
          }).catch(function (err) { toast(err.message); });
        });
      });
    });
    document.onkeydown = function (e) {
      if (e.code === "Space") {
        e.preventDefault();
        var first = $(".shadow-item");
        if (first) play(0, false);
      }
    };
  }

  /* ---------------- ② 句型 ---------------- */
  function renderPatterns() {
    var sc = scenarioForToday();
    var idx = 0;

    var body =
      '<h2>② 句型打磨 <span class="faint small">20 分钟</span></h2>' +
      '<div class="small muted" style="margin-bottom:14px">先看中文，自己试着说英文，再点“翻面”对照。' +
      '每个句型要自己造 2 句——写不写都行，但<b>说出来</b>才算数。</div>' +
      '<div id="pattern-body"></div>';

    sessionShell("句型打磨", sc.title + " · 共 " + sc.patterns.length + " 个句型", body, "patterns");

    function draw() {
      var p = sc.patterns[idx];
      var key = sc.id + "|" + idx;
      var known = !!state.patterns[key];
      var el = $("#pattern-body");
      el.innerHTML =
        '<div class="small faint" style="text-align:center;margin-bottom:8px">' + (idx + 1) + " / " + sc.patterns.length + "</div>" +
        '<div class="flash" id="flash">' +
          '<div class="front" id="flash-front">' + esc(p.zh) + '</div>' +
          '<div class="hint" id="flash-hint">先自己说一遍，再点「翻面」</div>' +
        '</div>' +
        '<div class="row" style="margin-top:14px;justify-content:center">' +
          '<button class="btn" id="flip">翻面 / 播放</button>' +
          '<button class="btn ok" id="known">' + (known ? "已掌握 ✓" : "认识") + '</button>' +
          '<button class="btn bad" id="unknown">不认识</button>' +
          '<button class="btn ghost" id="prev">上一个</button>' +
          '<button class="btn ghost" id="next">下一个</button>' +
        '</div>' +
        '<div class="row" style="margin-top:14px">' +
          '<input type="text" id="own-sentence" placeholder="用这个句型造一句（可选，按回车保存）">' +
        '</div>' +
        '<div class="tiny faint" style="margin-top:8px">自己造的句子会存进进度，随时可以复制出来找人或找 AI 批改。</div>';

      var flipped = false;
      var restoring = null;

      function speakThis() {
        var btn = $("#flip");
        if (btn) { btn.textContent = "合成中…"; btn.disabled = true; }
        if (restoring) { clearTimeout(restoring); restoring = null; }

        function restore(label) {
          if (restoring) clearTimeout(restoring);
          restoring = null;
          var b = $("#flip");
          if (b) { b.textContent = label || "重新播放"; b.disabled = false; }
        }
        tts.speak(p.en, {
          onstart: function () { restore("🔊 播放中…"); },
          onend: function () { restore("重新播放"); }
        });
        // 兜底：8 秒还没回调就恢复按钮，避免一直卡在"合成中"
        restoring = setTimeout(function () { restore("重新播放"); }, 8000);
      }

      function flip() {
        if (!flipped) {
          flipped = true;
          $("#flash-front").innerHTML = '<div class="back">' + annotate(p.en) + '</div>' +
            (p.tip ? '<div class="tip" style="margin-top:10px">' + esc(p.tip) + "</div>" : "");
          $("#flash-hint").textContent = "跟读三遍，再点下一个";
        }
        speakThis();
      }
      $("#flip").addEventListener("click", flip);
      $("#flash").addEventListener("click", flip);
      $("#known").addEventListener("click", function () {
        state.patterns[key] = todayKey();
        state.weak = state.weak || {};
        var had = !!state.weak["pattern:" + key];
        delete state.weak["pattern:" + key];
        save();
        toast(had ? "已掌握，已从待巩固移除" : "已标记掌握");
        next();
      });
      $("#unknown").addEventListener("click", function () {
        state.weak = state.weak || {};
        var wk = "pattern:" + key;
        var rec = state.weak[wk] || { en: p.en, zh: p.zh, ex: "", count: 0 };
        rec.en = p.en;
        rec.zh = p.zh;
        rec.ex = "";
        rec.type = "pattern";
        rec.count = (rec.count || 0) + 1;
        rec.at = todayKey();
        state.weak[wk] = rec;
        save();
        toast("已加入待巩固");
        next();
      });
      $("#prev").addEventListener("click", function () { idx = (idx - 1 + sc.patterns.length) % sc.patterns.length; draw(); });
      $("#next").addEventListener("click", next);
      $("#own-sentence").addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        var v = e.target.value.trim();
        if (!v) return;
        state.sentences.push({ at: todayKey(), scenarioId: sc.id, pattern: p.en, text: v });
        save();
        e.target.value = "";
        toast("已保存，今天累计 " + state.sentences.filter(function (s) { return s.at === todayKey(); }).length + " 句");
      });
      document.onkeydown = function (e) {
        if (e.code === "Space") { e.preventDefault(); flip(); }
      };
    }
    function next() { idx = (idx + 1) % sc.patterns.length; draw(); }
    draw();
  }

  /* ---------------- ③ 单词 ---------------- */
  function renderWordStage() {
    var sc = scenarioForToday();
    var queue = [];
    dueWords().forEach(function (d) {
      var rec = state.srs[d.key];
      if (rec && rec.last === todayKey()) return;
      queue.push({ key: d.key, word: d.word, isNew: false });
    });
    newWordsOf(sc.id, 15).forEach(function (item) { queue.push({ key: item.key, word: item, isNew: true }); });
    runWords(queue.slice(0, 40), "场景单词", "新词 + 到期复习 · 共 " + Math.min(queue.length, 40) + " 张", "words",
      '<h2>③ 场景单词 <span class="faint small">15 分钟</span></h2>');
  }

  // 单词卡显示模式：both = 英中同时显示 / en = 只显示英文 / zh = 只显示中文
  function cardMode() {
    var m = state.settings.cardMode;
    return (m === "en" || m === "zh") ? m : "both";
  }

  // 通用单词卡流程：今日第③步、词包学习、复习页都复用它
  function runWords(queue, title, subtitle, markStageId, headingHtml, sessKey) {
    var body = (headingHtml || '<h2>' + esc(title) + '</h2>') +
      '<div class="small muted" style="margin-bottom:14px">先看英文回忆意思，点开对照，再选“认识 / 不认识”。' +
      '不认识的会进「待巩固」，回头单独练。</div>' +
      '<div id="word-body"></div>';
    sessionShell(title, subtitle, body, markStageId);

    var key = sessKey || markStageId || null;
    currentSessKey = key;
    var startPos = 0, startRight = 0;

    if (key) {
      var saved = (state.sessions || {})[key];
      if (saved && saved.at === todayKey() && saved.keys && saved.keys.length) {
        var byKey = {};
        REGISTRY.forEach(function (it) { byKey[it.key] = it; });
        var rebuilt = [];
        saved.keys.forEach(function (k) {
          var it = byKey[k];
          if (it) rebuilt.push({ key: it.key, word: it, isNew: !state.srs[it.key] });
        });
        if (rebuilt.length) {
          queue = rebuilt;
          startPos = Math.min(saved.pos || 0, Math.max(0, rebuilt.length - 1));
          startRight = saved.right || 0;
        }
      }
    }

    if (!queue.length) {
      $("#word-body").innerHTML = '<div class="empty">今天没有到期的单词，也没有新词了 🎉<br><span class="tiny">明天再来</span></div>';
      return;
    }

    // 进卡片组时后台批量预取，点词就能秒出
    setTimeout(function () {
      audioPack.preload(queue.slice(0, 24).map(function (q) {
        return q.word && q.word.en;
      }), 6);
    }, 300);

    var pos = startPos, right = startRight;

    function saveSession() {
      if (!key) return;
      state.sessions = state.sessions || {};
      state.sessions[key] = {
        keys: queue.map(function (q) { return q.key; }),
        pos: pos,
        right: right,
        at: todayKey()
      };
      save();
    }

    function clearSession() {
      if (!key) return;
      if (state.sessions) delete state.sessions[key];
      save();
    }

    function draw(step) {
      if (pos >= queue.length) {
        clearSession();
        activeStage = null;
        var weakCount = Object.keys(state.weak || {}).length;
        $("#word-body").innerHTML =
          '<div class="empty">这一组过完了：' + right + " / " + queue.length + " 一眼认出<br>" +
          '<span class="tiny">' + (weakCount ? "待巩固里还有 " + weakCount + " 个词，可以去「复习 → 待巩固」再练一轮" : "没有需要额外巩固的词") + "</span></div>";
        if (key === "weak" || key === "random") { setTimeout(function () { go("review"); }, 1400); }
        return;
      }
      var q = queue[pos];
      var mode = cardMode();      // both | en | zh
      var revealed = false;

      // 显示模式切换条
      var modeBar =
        '<div class="card-mode" id="card-mode">' +
          '<button data-card-mode="both"' + (mode === "both" ? ' class="on"' : "") + '>英+中</button>' +
          '<button data-card-mode="en"' + (mode === "en" ? ' class="on"' : "") + '>仅英文</button>' +
          '<button data-card-mode="zh"' + (mode === "zh" ? ' class="on"' : "") + '>仅中文</button>' +
        '</div>';

      $("#word-body").innerHTML =
        '<div class="small faint" style="text-align:center;margin-bottom:6px">' +
          (pos + 1) + " / " + queue.length + (q.isNew ? ' <span class="badge">新词</span>' : ' <span class="badge warn">复习</span>') +
        '</div>' +
        modeBar +
        '<div class="word-card" id="word-card" data-no-swipe>' +
          '<div class="wc-arrow wc-arrow-left">‹</div>' +
          '<div class="wc-arrow wc-arrow-right">›</div>' +
          '<div id="wc-face"></div>' +
          '<div class="wc-flash" id="wc-flash"></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px;justify-content:center">' +
          '<button class="btn" id="w-say">🔊 听发音</button>' +
        '</div>' +
        '<div class="row" style="justify-content:center">' + recorderHtml("rec-word") + '</div>' +
        '<div class="row" id="w-grades" style="margin-top:12px;justify-content:center">' +
          '<button class="btn ok" data-grade="2">认识</button>' +
          '<button class="btn bad" data-grade="0">不认识</button>' +
        '</div>' +
        '<div class="tiny faint" style="text-align:center;margin-top:8px">' +
          '点左 = 上一个 · 点右 = 下一个 · 左滑 下一个 · 右滑 上一个 · 点中间 看对照' +
        '</div>';

      var cardEl = $("#word-card");
      if (cardEl && step !== 0) {
        cardEl.classList.add(step === -1 ? "slide-left" : "slide-right");
        setTimeout(function () {
          if (cardEl) cardEl.classList.remove("slide-left", "slide-right");
        }, 420);
      }

      if (q.word.en) tts.speak(q.word.en);
      audioPack.prefetchAhead(queue, pos + 1, 5);
      saveSession();

      /* ---------- 渲染卡面 ---------- */
      function enHtml() {
        return '<div class="big en">' + esc(q.word.en) + "</div>" + ipaHtml(q.word.en);
      }
      function zhHtml() {
        return '<div class="zh-main">' + esc(q.word.zh) + "</div>";
      }
      function exHtml() {
        if (!q.word.ex) return "";
        return '<div class="ex" style="margin-top:12px">' + annotate(q.word.ex) + "</div>";
      }

      function paintFace() {
        var face = document.getElementById("wc-face");
        if (!face) return;
        if (mode === "both") {
          face.innerHTML = enHtml() + zhHtml() + exHtml();
          return;
        }
        if (mode === "en") {
          face.innerHTML = revealed
            ? enHtml() + zhHtml() + exHtml()
            : enHtml() + '<div class="hint faint tiny" style="margin-top:10px">点中间看中文</div>';
          return;
        }
        // zh
        face.innerHTML = revealed
          ? zhHtml() + enHtml() + exHtml()
          : zhHtml() + '<div class="hint faint tiny" style="margin-top:10px">点中间看英文</div>';
      }
      paintFace();

      function toggleReveal() {
        if (mode === "both") { tts.speak(q.word.en); return; }
        revealed = !revealed;
        paintFace();
        if (revealed && mode === "en") tts.speak(q.word.en);
      }

      /* ---------- 手势提示 ---------- */
      function flash(text, kind) {
        var f = document.getElementById("wc-flash");
        if (!f) return;
        f.textContent = text || "";
        f.className = "wc-flash" + (text ? " show " : "") + (kind || "");
      }

      /* ---------- 评分并翻页（唯一的自动前进方式） ---------- */
      function grade(g) {
        if (q.kind === "pattern") {
          var pkey = String(q.key).replace(/^pattern:/, "");
          if (g === 2) state.patterns[pkey] = todayKey();
          markWeak(q, g);
        } else {
          reviewWord(q.key, g);
          markWeak(q, g);
          if (g === 2 && state.srs[q.key]) state.srs[q.key].done = true;
        }
        if (g === 2) right++;
        pos++;
        draw(1);
      }

      /* ---------- 翻页（不评分） ---------- */
      function goNext() {
        if (pos + 1 <= queue.length) { pos++; draw(1); }
      }
      function goPrev() {
        if (pos > 0) { pos--; draw(-1); }
        else toast("已经是第一个了");
      }

      /* ---------- 模式切换 ---------- */
      $$("[data-card-mode]").forEach(function (b) {
        b.addEventListener("click", function () {
          state.settings.cardMode = b.dataset.cardMode;
          save();
          draw(0);           // 重画当前卡，保持 pos
        });
      });

      /* ---------- 按钮 ---------- */
      $("#w-say").addEventListener("click", function () { tts.speak(q.word.en); });
      bindRecorder($("#word-body"), q.word.en);
      $$("[data-grade]").forEach(function (b) {
        b.addEventListener("click", function () { grade(Number(b.dataset.grade)); });
      });

      /* ---------- 手势 ---------- */
      var sx = 0, sy = 0, st = 0, dx = 0, dy = 0;
      var dragging = false, moved = false;

      function onDown(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        sx = e.clientX; sy = e.clientY; st = Date.now();
        dx = 0; dy = 0;
        dragging = true; moved = false;
        cardEl.style.transition = "none";
        try { cardEl.setPointerCapture(e.pointerId); } catch (err) {}
      }

      function onMove(e) {
        if (!dragging) return;
        dx = e.clientX - sx;
        dy = e.clientY - sy;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx > 8 || ady > 8) moved = true;
        if (adx >= ady && adx > 6) {
          cardEl.style.transform = "translate3d(" + dx + "px,0,0)";
          if (dx < -26) flash("下一个", "ok");
          else if (dx > 26) flash("上一个", "prev");
          else flash("");
        } else if (ady > 18 && ady > adx) {
          // 上下不做判定，卡片回弹
          cardEl.style.transform = "translate3d(0,0,0)";
          flash("");
        } else {
          cardEl.style.transform = "translate3d(" + dx + "px,0,0)";
        }
      }

      function onUp(e) {
        if (!dragging) return;
        dragging = false;
        dx = e.clientX - sx;
        dy = e.clientY - sy;
        cardEl.style.transition = "transform .2s cubic-bezier(.22,.61,.36,1)";
        var dt = Date.now() - st;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        cardEl.style.transform = "";
        flash("");

        // 轻点：左半边下一个，右半边上一个，中间看对照
        if (adx < 12 && ady < 12) {
          if (dt < 800) {
            var r = cardEl.getBoundingClientRect();
            var pp = (e.clientX - r.left) / Math.max(1, r.width);
            if (pp < 0.33) { goPrev(); return; }   // 点左侧 = 上一个
            if (pp > 0.67) { goNext(); return; }   // 点右侧 = 下一个
            toggleReveal();
          }
          return;
        }

        // 左滑 = 下一个，右滑 = 上一个（都不评分）
        if (adx > 46 && adx > ady) {
          if (dx < 0) goNext(); else goPrev();
        }
      }

      cardEl.addEventListener("pointerdown", onDown);
      cardEl.addEventListener("pointermove", onMove);
      cardEl.addEventListener("pointerup", onUp);
      cardEl.addEventListener("pointercancel", function () {
        dragging = false;
        cardEl.style.transform = "";
        cardEl.style.transition = "";
        flash("");
      });

      /* ---------- 键盘（桌面版） ---------- */
      document.onkeydown = function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); goNext(); return; }
        if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); grade(2); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); grade(0); return; }
        if (e.code === "Space" || e.key === " " || e.keyCode === 32) {
          e.preventDefault();
          if (mode === "both") tts.speak(q.word.en);
          else toggleReveal();
          return;
        }
      };
    }
    draw(0);
    if (startPos > 0) toast("接着上次：第 " + (startPos + 1) + " 张");
  }

  /* ---------------- ④ 输出 ---------------- */
  function renderOutput() {
    var sc = scenarioForToday();
    var turns = sc.dialogue.turns;
    var step = 0;
    var log = [];

    var body = '<h2>④ 开口输出 <span class="faint small">20 分钟</span></h2>' +
      '<div class="small muted" style="margin-bottom:14px">我演对方，你演自己。选一句最合适的回答——选错会告诉你为什么。' +
      '说出口再点，不要只在心里想。</div>' +
      '<div class="chat" id="chat"></div>' +
      '<div id="chat-end"></div>';
    sessionShell("角色扮演", sc.dialogue.title, body, "output");

    function pushStaff(t) {
      var el = document.createElement("div");
      el.className = "bubble staff";
      el.innerHTML = annotate(t.en) + ipaHtml(t.en, "sm") + '<span class="zh">' + esc(t.zh) + '</span>' +
        '<button class="say" data-say="' + esc(t.en) + '">🔊</button>';
      $("#chat").appendChild(el);
      el.querySelector(".say").addEventListener("click", function () { tts.speak(t.en); });
    }
    function pushYou(text) {
      var el = document.createElement("div");
      el.className = "bubble you";
      el.innerHTML = esc(text) + recorderHtml("rec-you-" + Math.random().toString(36).slice(2, 7));
      $("#chat").appendChild(el);
      bindRecorder(el, text);
    }
    // 播完这一句再继续，避免下一句把上一句 cancel 掉
    function speakThen(text, gap) {
      return new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          setTimeout(resolve, gap == null ? 260 : gap);
        }
        tts.speak(text, { onend: finish, onerror: finish });
        // 兜底：按字数估算，防止 onend 不回调时卡住
        var est = Math.max(1400, Math.min(12000, String(text).length * 95));
        setTimeout(finish, est + 3000);
      });
    }

    function advance() {
      if (step >= turns.length) { finish(); return; }
      var t = turns[step];
      if (t.who === "staff") {
        pushStaff(t);
        step++;
        speakThen(t.en, 180).then(advance);
        return;
      }
      // 你的回合
      var wrap = document.createElement("div");
      wrap.className = "options";
      t.options.forEach(function (opt) {
        var b = document.createElement("button");
        b.className = "option";
        b.innerHTML = annotate(opt.en) + '<span class="zh">' + esc(opt.zh) + "</span>";
        b.addEventListener("click", function () {
          if (opt.ok) {
            wrap.remove();
            pushYou(opt.en);
            step++;
            speakThen(opt.en, 320).then(advance);
          } else {
            b.classList.add("wrong");
            if (!b.querySelector(".why")) {
              var w = document.createElement("span");
              w.className = "why";
              w.textContent = "✗ " + (opt.why || "这句不太合适，再试一次");
              b.appendChild(w);
            }
            b.disabled = true;
          }
        });
        wrap.appendChild(b);
      });
      $("#chat").appendChild(wrap);
    }

    function finish() {
      var done = log.length;
      $("#chat-end").innerHTML =
        '<div class="card" style="margin-top:16px">' +
          '<h3>对话走完了 🎉</h3>' +
          '<div class="small muted" style="margin-bottom:12px">现在用今天学过的句型，写 2 句关于你自己的话（比如你要去哪、住哪、想吃什么）。' +
          '写不出来的地方先用中文打出来也行。</div>' +
          '<textarea id="free-write" placeholder="例：I am flying to Tokyo next month. I will stay at a hotel near the station."></textarea>' +
          '<div class="row" style="margin-top:10px">' +
            '<button class="btn primary" id="save-write">保存这两句</button>' +
            '<button class="btn" id="check-write">检查拼写 / 语法</button>' +
            '<button class="btn" id="copy-prompt">复制批改请求</button>' +
          '</div>' +
          '<div id="write-check" style="margin-top:12px"></div>' +
          '<div class="tiny faint" style="margin-top:8px">“复制批改请求”会把你的句子整理成一段话，你可以粘贴给任何人或 AI 帮你改。</div>' +
        '</div>';
      $("#save-write").addEventListener("click", function () {
        var v = $("#free-write").value.trim();
        if (!v) { toast("先写两句"); return; }
        state.sentences.push({ at: todayKey(), scenarioId: sc.id, pattern: "free-write", text: v });
        save();
        toast("已保存");
      });
      $("#copy-prompt").addEventListener("click", function () {
        var v = $("#free-write").value.trim();
        copyText(aiPrompt(v, analyzeText(v)));
      });
      var checkBox = $("#write-check");
      function rerunCheck(text) {
        $("#free-write").value = text;
        renderIssues(checkBox, text, analyzeText(text), rerunCheck);
      }
      $("#check-write").addEventListener("click", function () {
        var v = $("#free-write").value;
        if (!v.trim()) { toast("先写两句再检查"); return; }
        rerunCheck(v);
      });
    }

    advance();
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("已复制到剪贴板"); }
      catch (e) { toast("复制失败，请手动选择文本"); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("已复制到剪贴板"); }, fallback);
    } else { fallback(); }
  }

  /* ---------------- 每日收尾自测 ---------------- */
  function renderDailyQuiz() {
    var sc = scenarioForToday();
    var pool = [];
    sc.words.forEach(function (w) { pool.push({ en: w.en, zh: w.zh, ex: w.ex }); });
    shuffle(pool);
    pool = pool.slice(0, 6);

    var body = '<h2>⑤ 每日收尾 <span class="faint small">3 分钟</span></h2>' +
      '<div class="small muted" style="margin-bottom:14px">听英文选中文。答错没关系，明天复习会再出现。</div>' +
      '<div id="quiz-body"></div>';
    sessionShell("每日自测", sc.title, body, "retest");

    var i = 0, right = 0;
    function draw() {
      if (i >= pool.length) {
        $("#quiz-body").innerHTML = '<div class="empty">答对 ' + right + " / " + pool.length +
          '<div class="tiny">明天同一时间再来</div></div>';
        return;
      }
      var q = pool[i];
      var opts = [q.zh];
      var others = shuffle(sc.words.filter(function (w) { return w.zh !== q.zh; })).slice(0, 3);
      others.forEach(function (o) { opts.push(o.zh); });
      shuffle(opts);

      $("#quiz-body").innerHTML =
        '<div class="small faint" style="text-align:center">' + (i + 1) + " / " + pool.length + "</div>" +
        '<div class="word-card" style="margin-top:8px">' +
          '<div style="font-size:14px;color:var(--text-3)">听发音，选意思</div>' +
          '<button class="btn" id="quiz-play" style="margin:10px auto;display:block">🔊 再听一遍</button>' +
        '</div>' +
        '<div class="options" id="quiz-options" style="margin-top:12px">' +
          opts.map(function (o) {
            return '<button class="option" data-zh="' + esc(o) + '">' + esc(o) + "</button>";
          }).join("") +
        "</div>";

      tts.speak(q.en);
      $("#quiz-play").addEventListener("click", function () { tts.speak(q.en); });
      $$("#quiz-options .option").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.dataset.zh === q.zh) { b.classList.add("correct"); right++; }
          else {
            b.classList.add("wrong");
            $$("#quiz-options .option").forEach(function (x) {
              if (x.dataset.zh === q.zh) x.classList.add("correct");
            });
          }
          $$("#quiz-options .option").forEach(function (x) { x.disabled = true; });
          setTimeout(function () { i++; draw(); }, 700);
        });
      });
    }
    draw();
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 复习 ---------------- */
  function renderReview() {
    var due = dueWords();
    var learned = [];
    REGISTRY.forEach(function (it) {
      if (state.srs[it.key]) learned.push(it);
    });
    var weak = weakList();

    var html = '<div class="card"><h1>复习</h1>' +
      '<div class="muted small">到期复习按 1 → 2 → 4 → 7 → 15 → 30 → 60 天安排。打分只有「认识 / 不认识」两种。</div>' +
      '<div class="stats-strip">' +
        '<div class="stat"><div class="num">' + due.length + '</div><div class="lbl">今天到期</div></div>' +
        '<div class="stat"><div class="num">' + learned.length + '</div><div class="lbl">总词数</div></div>' +
        '<div class="stat"><div class="num">' + weak.length + '</div><div class="lbl">待巩固</div></div>' +
      '</div>' +

      // 总词数：点开看是哪些词
      '<details class="today-box" style="margin-top:14px"><summary>总词数 <b>' + learned.length + '</b></summary>' +
        (learned.length ? '<div class="row" style="margin-top:10px"><button class="btn primary" id="random-drill">随机练习（最多 30 个）</button></div>' : '') +
        (learned.length
          ? '<div class="list" style="margin-top:10px">' + learned.slice().sort(function (a, b) {
              return (state.srs[b.key].box || 0) - (state.srs[a.key].box || 0);
            }).map(function (w) {
              var rec = state.srs[w.key];
              return '<div class="list-item"><div style="flex:1"><div class="en">' + esc(w.en) + '</div>' +
                '<div class="zh">' + esc(w.zh) + '</div></div>' +
                '<span class="badge ok">第 ' + ((rec.box || 0) + 1) + ' 档 · ' + esc(rec.due || "") + '</span>' +
                '<button class="btn ghost" data-say="' + esc(w.en) + '">🔊</button></div>';
            }).join("") + '</div>'
          : '<div class="empty">还没有学过的词</div>') +
      '</details>' +

      // 待巩固：放在总词数下面，可折叠，每项可移出
      '<details class="today-box" data-rv-weak' + (openSections["rv|weak"] ? " open" : "") +
        '><summary>待巩固 <b>' + weak.length + '</b></summary>' +
        '<div class="tiny faint" style="margin:8px 0 0">标「不认识」的词和句型会进这里，到「专项练习」里练到「认识」就自动消失。</div>' +
        (weak.length ? '<div class="row" style="margin-top:10px"><button class="btn primary" id="weak-drill">专项练习（' + weak.length + '）</button></div>' : '') +
        (weak.length
          ? '<div class="list" style="margin-top:10px">' + weak.map(function (w) {
              return '<div class="list-item"><div style="flex:1"><div class="en">' + esc(w.word.en) + '</div>' +
                '<div class="zh">' + esc(w.word.zh) + '</div></div>' +
                '<span class="badge ' + (w.kind === "pattern" ? "warn" : "") + '">' + (w.kind === "pattern" ? "句型" : "单词") + '</span>' +
                '<span class="badge">错 ' + (w.rec.count || 1) + ' 次</span>' +
                '<button class="btn ghost" data-say="' + esc(w.word.en) + '">🔊</button></div>';
            }).join("") + '</div>'
          : '<div class="empty" style="margin-top:10px">还没有需要巩固的词 👍</div>') +
      '</details>' +

      '<div class="row" style="margin-top:14px">' +
        (due.length ? '<button class="btn primary" id="start-review">开始复习（' + due.length + '）</button>' : '<span class="faint">今天没有到期的词</span>') +
      '</div></div>';

    if (due.length) {
      html += '<div class="card"><details class="today-box" open><summary>到期清单 <b>' + due.length + '</b> 个</summary>' +
        '<div class="list" style="margin-top:10px">' +
        due.map(function (d) {
          return '<div class="list-item"><div style="flex:1"><div class="en">' + esc(d.word.en) +
            '</div><div class="zh">' + esc(d.word.zh) + '</div></div>' +
            '<span class="badge">第 ' + ((d.item.box || 0) + 1) + ' 档</span></div>';
        }).join("") + '</div></details></div>';
    }

    $("#view-review").innerHTML = html;

    var btn = $("#start-review");
    if (btn) btn.addEventListener("click", function () { go("today"); openStage("words"); });

    var weakBox = $("#view-review [data-rv-weak]");
    if (weakBox) {
      weakBox.addEventListener("toggle", function () {
        openSections["rv|weak"] = weakBox.open;
      });
    }

    var randBtn = $("#random-drill");
    if (randBtn) randBtn.addEventListener("click", function () {
      go("today");
      startRandomDrill();
    });

    var drillBtn = $("#weak-drill");
    if (drillBtn) drillBtn.addEventListener("click", function () {
      go("today");        // 学习界面渲染在「今日」页里，先切过去
      startWeakDrill();
    });

    $$("#view-review [data-say]").forEach(function (b) {
      b.addEventListener("click", function () { tts.speak(b.dataset.say); });
    });
  }

  /* ---------------- 自定义词库 ---------------- */
  function parseWordList(text) {
    var words = [], bad = 0;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t || t.charAt(0) === "#") return;
      var parts = t.split(/\s*[|｜\t]\s*/);
      if (parts.length < 2) parts = t.split(/\s*,\s*/);
      if (parts.length < 2) { bad++; return; }
      var en = parts[0].replace(/^["']|["']$/g, "").trim();
      var rest = parts.slice(1).map(function (s) { return s.trim(); }).filter(Boolean);
      var ipa = "";
      if (rest.length && /^[/\[].*[/\]]$/.test(rest[0])) ipa = rest.shift();
      var zh = rest.shift() || "";
      var ex = rest.join(" · ");
      if (!en || !zh) { bad++; return; }
      words.push({ en: en, zh: zh, ipa: ipa, ex: ex });
    });
    return { words: words, bad: bad };
  }

  function importWordFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var res = parseWordList(reader.result);
      if (!res.words.length) { toast("没解析到有效词条，检查是不是用 | 分隔"); return; }
      var pack = {
        id: "cp" + Date.now(),
        name: String(file.name).replace(/\.[^.]+$/, ""),
        at: todayKey(),
        words: res.words
      };
      state.customPacks = state.customPacks || [];
      state.customPacks.push(pack);
      save();
      renderWords();
      toast("导入 " + res.words.length + " 个词" + (res.bad ? "（跳过 " + res.bad + " 行）" : ""));
    };
    reader.onerror = function () { toast("文件读取失败"); };
    reader.readAsText(file, "utf-8");
  }

  function downloadWordTemplate() {
    var sample =
      "# EasyStudy 自定义词库模板\n" +
      "# 每行一个词：英文 | 中文 | 例句（可留空）| 音标（可留空，用 /…/ 包起来）\n" +
      "airport | 机场 | We arrived at the airport two hours early. | /ˈerpɔrt/\n" +
      "boarding pass | 登机牌 | Keep your boarding pass ready.\n" +
      "customs | 海关 | It took ten minutes to get through customs.\n";
    var name = "词库模板.txt";

    // 桌面版：弹原生「另存为」对话框，自己选位置
    if (window.DesktopFile && DesktopFile.available()) {
      DesktopFile.saveText(name, sample).then(function (res) {
        if (!res) { fallbackDownload(sample, name); return; }
        if (res.canceled) return;
        if (res.ok) toast("已保存到：" + res.path);
        else toast("保存失败：" + (res.error || "").slice(0, 60));
      });
      return;
    }
    fallbackDownload(sample, name);
  }

  function fallbackDownload(text, name) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("模板已下载");
  }

  function customPacksHtml() {
    var packs = state.customPacks || [];
    var out = '<div class="card"><h2 style="margin-bottom:4px">自定义词库</h2>' +
      '<div class="faint small" style="margin-bottom:12px">' +
      (packs.length
        ? "自己导入的词表，和内置词包一样可以学、可以复习。"
        : "还没有导入。点上面的「导入自定义词库」，支持 txt / csv，一行一个词。") +
      "</div>";
    packs.forEach(function (cp) {
      var learned = cp.words.filter(function (w) { return state.srs["custom:" + cp.id + "|" + w.en]; }).length;
      out += '<div class="card" style="background:var(--surface-2);margin-bottom:10px">' +
        '<div class="row"><h3 style="flex:1;margin:0">📄 ' + esc(cp.name) + "</h3>" +
        '<span class="badge">' + learned + " / " + cp.words.length + "</span>" +
        '<button class="btn primary" data-focus="' + esc(cp.id) + '" data-kind="custom" data-title="' + esc(cp.name) + '">开始学习</button>' +
        '<button class="btn ghost" data-del-pack="' + esc(cp.id) + '">删除</button></div>' +
        '<div class="list" style="margin-top:12px">' +
        cp.words.slice(0, 200).map(function (w) {
          var item = state.srs["custom:" + cp.id + "|" + w.en];
          var badge = item ? ('<span class="badge ok">第 ' + ((item.box || 0) + 1) + " 档</span>")
                           : '<span class="badge">未学</span>';
          return '<div class="list-item" data-en="' + esc(w.en.toLowerCase()) + '" data-zh="' + esc(w.zh) + '">' +
            '<div style="flex:1"><div class="en">' + esc(w.en) + "</div>" +
            (w.ipa ? '<div class="ipa sm">' + esc(w.ipa) + "</div>" : "") +
            '<div class="zh">' + esc(w.zh) + (w.ex ? " · " + esc(w.ex) : "") + "</div></div>" + badge +
            '<button class="btn ghost" data-say="' + esc(w.en) + '">🔊</button></div>';
        }).join("") +
        (cp.words.length > 200 ? '<div class="tiny faint">仅显示前 200 个，学习时全部会用到</div>' : "") +
        "</div></div>";
    });
    return out + "</div>";
  }

  /* ---------------- 词库 ---------------- */
  function renderWords() {
    var totalWords = REGISTRY.length;
    var html = '<div class="card"><h1>词库</h1>' +
      '<div class="small muted">共 <b>' + totalWords + '</b> 个词条：场景词（A1 生存）' +
      ' + 分级词包（A2 生活 / B1 学术） + 高频核心词 <b>' + coreWordCount() + '</b> 个' +
      ((state.customPacks || []).length ? ' + 自定义 ' + state.customPacks.length + ' 组' : '') +
      '。已学 <b>' + learnedWordCount() + '</b> 个。</div>' +
      '<div class="row" style="margin-top:12px"><input type="text" id="word-search" placeholder="搜索英文或中文…（跨所有词库）"></div>' +
      '<div id="word-search-result" hidden></div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn primary" id="word-import">导入自定义词库</button>' +
        '<button class="btn ghost" id="word-template">下载模板</button>' +
        '<input type="file" id="word-import-file" accept=".txt,.csv" style="display:none">' +
        '<span class="tiny faint">格式：英文 | 中文 | 例句（可选第 4 列音标），一行一个词</span>' +
      '</div>' +
      '</div></div>';

    function section(key, title, subtitle, groups) {
      var open = !!openSections[key];
      var total = 0, learnedTotal = 0;
      groups.forEach(function (g) {
        total += g.words.length;
        g.words.forEach(function (w) { if (state.srs[g.keyOf(w)]) learnedTotal++; });
      });
      var out = '<div class="card acc" style="padding:0;overflow:hidden">' +
        '<button class="acc-head" data-acc="' + key + '">' +
          '<span class="acc-arrow">' + (open ? "\u25be" : "\u25b8") + '</span>' +
          '<span class="acc-title">' + title + '</span>' +
          '<span class="badge">' + learnedTotal + " / " + total + '</span>' +
        '</button>' +
        '<div class="acc-body"' + (open ? "" : ' hidden') + '>' +
        '<div class="faint small" style="margin:0 18px 10px">' + subtitle + '</div>';
      groups.forEach(function (g) {
        var words = g.words;
        var gkey = key + "|" + g.id;
        var gopen = !!openGroups[gkey];
        var learned = words.filter(function (w) { return state.srs[g.keyOf(w)]; }).length;
        out += '<div class="card" style="background:var(--surface-2);margin:0 18px 10px;padding:0">' +
          '<div class="row" style="padding:12px 14px">' +
            '<button class="g-head" data-group="' + gkey + '">' +
              '<span class="acc-arrow">' + (gopen ? "\u25be" : "\u25b8") + '</span>' +
              '<span class="g-title">' + (g.icon || "") + " " + esc(g.title) + '</span>' +
            '</button>' +
            '<span class="badge">' + learned + " / " + words.length + "</span>" +
            '<button class="btn primary" data-focus="' + esc(g.id) + '" data-kind="' + esc(g.kind) +
              '" data-title="' + esc(g.title) + '">开始学习</button></div>' +
          '<div class="list g-body" style="padding:0 14px 14px"' + (gopen ? "" : " hidden") + '>' +
          words.map(function (w) {
            var item = state.srs[g.keyOf(w)];
            var badge = item ? ('<span class="badge ok">第 ' + ((item.box || 0) + 1) + ' 档 · ' + item.due + "</span>")
                             : '<span class="badge">未学</span>';
            return '<div class="list-item" data-en="' + esc(w.en.toLowerCase()) + '" data-zh="' + esc(w.zh) + '"' +
              ' data-detail="' + esc(g.keyOf(w)) + '" style="cursor:pointer">' +
              '<div style="flex:1"><div class="en">' + esc(w.en) + '</div>' +
              ipaHtml(w.en, "sm") +
              '<div class="zh">' + esc(w.zh) + (w.ex ? " · " + esc(w.ex) : "") + "</div></div>" + badge +
              '<button class="btn ghost" data-say="' + esc(w.en) + '">🔊</button></div>';
          }).join("") +
          "</div></div>";
      });
      return out + "</div></div>";
    }

    var coreGroups = CORE.map(function (b) {
      return {
        id: b.id, kind: "core", title: b.title, icon: "\u2b50",
        words: (b.words || []).map(function (r) { return { en: r[0], zh: r[1], ex: r[2] || "" }; }),
        keyOf: function (w) { return "core:" + b.id + "|" + w.en; }
      };
    });
    var scenGroups = DATA.scenarios.map(function (sc) {
      return { id: sc.id, kind: "scenario", title: sc.title, icon: sc.icon, words: sc.words,
        keyOf: function (w) { return wordKey(sc.id, w.en); } };
    });
    var packGroups = PACKS.map(function (pk) {
      return { id: pk.id, kind: "pack", title: pk.title + " · " + pk.level, icon: pk.icon, words: pk.words,
        keyOf: function (w) { return "pack:" + pk.id + "|" + w.en; } };
    });

    html += section("core", "高频核心词", "通用高频词，" + coreWordCount() + " 个，分批收录；一天 15 个，按 SRS 自动复习。", coreGroups);
    html += section("a1", "A1 生存场景", "出国前 4 周要掌握的部分，每天 15 个。", scenGroups);
    html += section("a2", "A2 生活词包", "医院、银行、租房、紧急、社交——生活里躲不开。", packGroups.filter(function (g) {
      return g.title.indexOf("A2") >= 0;
    }));
    html += section("b1", "B1 学术词包", "雅思/托福高频话题词，写作口语都用得上。", packGroups.filter(function (g) {
      return g.title.indexOf("B1") >= 0;
    }));

    // 自定义词库
    html += customPacksHtml();

    $("#view-words").innerHTML = html;

    // 词库导入 / 删除
    var fileInput = $("#word-import-file");
    if (fileInput) {
      fileInput.addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) importWordFile(f);
        e.target.value = "";
      });
    }
    var importBtn = $("#word-import");
    if (importBtn) importBtn.addEventListener("click", function () { $("#word-import-file").click(); });
    var tplBtn = $("#word-template");
    if (tplBtn) tplBtn.addEventListener("click", downloadWordTemplate);
    $$("#view-words [data-del-pack]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.delPack;
        var pack = (state.customPacks || []).filter(function (p) { return p.id === id; })[0];
        if (!pack) return;
        if (!confirm("删除自定义词库「" + pack.name + "」？学习记录会保留，但词条会从词库移除。")) return;
        state.customPacks = state.customPacks.filter(function (p) { return p.id !== id; });
        save();
        renderWords();
        toast("已删除");
      });
    });

    $$("#view-words [data-say]").forEach(function (b) {
      b.addEventListener("click", function (ev) { ev.stopPropagation(); tts.speak(b.dataset.say); });
    });
    $$("#view-words [data-detail]").forEach(function (el) {
      el.addEventListener("click", function () { showWordDetail(el.dataset.detail); });
    });
    $$("#view-words [data-group]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.dataset.group;
        openGroups[key] = !openGroups[key];
        var card = b.closest(".card");
        var body = card ? card.querySelector(".g-body") : null;
        if (body) body.hidden = !openGroups[key];
        var arrow = b.querySelector(".acc-arrow");
        if (arrow) arrow.textContent = openGroups[key] ? "\u25be" : "\u25b8";
      });
    });
    $$("#view-words [data-acc]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.dataset.acc;
        openSections[key] = !openSections[key];
        var body = b.parentNode.querySelector(".acc-body");
        if (body) body.hidden = !openSections[key];
        var arrow = b.querySelector(".acc-arrow");
        if (arrow) arrow.textContent = openSections[key] ? "\u25be" : "\u25b8";
      });
    });
    $$("#view-words [data-focus]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        focusGroup(b.dataset.kind, b.dataset.focus, b.dataset.title);
      });
    });
    var search = $("#word-search");
    var searchBox = $("#word-search-result");
    if (search) search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      if (!q) {
        searchBox.hidden = true;
        searchBox.innerHTML = "";
        return;
      }
      var hits = REGISTRY.filter(function (it) {
        return it.en.toLowerCase().indexOf(q) >= 0 || String(it.zh || "").toLowerCase().indexOf(q) >= 0;
      });
      searchBox.hidden = false;
      if (!hits.length) {
        searchBox.innerHTML = '<div class="empty" style="margin-top:12px">没有找到「' + esc(q) + '」</div>';
        return;
      }
      searchBox.innerHTML =
        '<div class="tiny faint" style="margin-top:12px">找到 <b>' + hits.length + '</b> 个词（点词看详情）</div>' +
        '<div class="list" style="margin-top:8px">' +
        hits.slice(0, 200).map(function (it) {
          var rec = state.srs[it.key];
          return '<div class="list-item" data-detail="' + esc(it.key) + '">' +
            '<div style="flex:1"><div class="en">' + esc(it.en) + '</div>' + ipaHtml(it.en, "sm") +
            '<div class="zh">' + esc(it.zh) + '</div></div>' +
            '<span class="badge">' + esc(it.groupTitle || "") + '</span>' +
            (rec ? '<span class="badge ok">第 ' + ((rec.box || 0) + 1) + ' 档</span>' : '<span class="badge">未学</span>') +
            '<button class="btn ghost" data-say="' + esc(it.en) + '">🔊</button></div>';
        }).join("") +
        '</div>' +
        (hits.length > 200 ? '<div class="tiny faint">只显示前 200 个</div>' : "");
      $$("#word-search-result [data-say]").forEach(function (b) {
        b.addEventListener("click", function (ev) { ev.stopPropagation(); tts.speak(b.dataset.say); });
      });
      $$("#word-search-result [data-detail]").forEach(function (el) {
        el.addEventListener("click", function () { showWordDetail(el.dataset.detail); });
      });
    });
  }

  /* ---------------- 写作检查 ---------------- */
  function typeName(t) {
    return { spelling: "拼写", grammar: "语法", style: "大小写", punctuation: "标点" }[t] || t;
  }

  function analyzeText(text) {
    if (!CHECKER) return null;
    return CHECKER.check(text, DICT);
  }

  function highlightErrors(text, issues) {
    var out = "", last = 0;
    issues.forEach(function (it) {
      if (it.index < last || it.index > text.length) return;
      out += esc(text.slice(last, it.index));
      if (it.length > 0) {
        var seg = text.slice(it.index, it.index + it.length);
        out += '<mark class="err ' + it.type + '" title="' + esc(it.message) + '">' + esc(seg) + "</mark>";
        last = it.index + it.length;
      } else {
        out += '<mark class="err-punct" title="' + esc(it.message) + '">␣</mark>';
        last = it.index;
      }
    });
    out += esc(text.slice(last));
    return out;
  }

  function renderIssues(box, text, result, rerun) {
    if (!result) { box.innerHTML = '<div class="empty">检查器未加载</div>'; return; }
    var s = result.stats;
    var html = '<div class="row" style="margin-bottom:10px">' +
      '<span class="badge">' + s.words + " 词</span>" +
      '<span class="badge ' + (s.errors ? "warn" : "ok") + '">' + s.errors + " 处问题</span></div>";
    if (!s.errors) {
      html += '<div class="empty">没发现拼写或常见语法错误 ✅<br>' +
        '<span class="tiny">规则只抓硬错误，语感和地道表达仍然需要人看</span></div>';
      box.innerHTML = html;
      return;
    }
    html += '<div class="preview">' + highlightErrors(text, result.issues) + "</div>";
    html += '<div class="list">' + result.issues.map(function (it, i) {
      return '<div class="list-item"><div style="flex:1">' +
        '<div><span class="badge ' + (it.type === "spelling" ? "bad" : "warn") + '">' + typeName(it.type) + "</span> " +
        esc(it.message) + "</div></div>" +
        (it.suggestion ? '<button class="btn tiny" data-fix="' + i + '">改成 ' + esc(it.suggestion) + "</button>" : "") +
        "</div>";
    }).join("") + "</div>";
    box.innerHTML = html;
    $$("[data-fix]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var it = result.issues[Number(b.dataset.fix)];
        var fixed = text.slice(0, it.index) + (it.suggestion || "") + text.slice(it.index + (it.length || 0));
        rerun(fixed);
      });
    });
  }

  function aiPrompt(text, result) {
    var lines = [
      "请帮我批改下面的英文。我是 A0–A1 水平的初学者。",
      "要求：1) 逐句指出语法和用词错误，用中文解释；2) 给出更自然的说法；3) 最后列出 2 个我最需要改的习惯。",
      ""
    ];
    if (result && result.issues && result.issues.length) {
      lines.push("（本地规则已经检测到这些可疑点，供你参考，不必逐条重复）");
      result.issues.forEach(function (it) { lines.push("- " + it.message); });
      lines.push("");
    }
    lines.push("原文：");
    lines.push(text || "(还没有内容)");
    return lines.join("\n");
  }

  /* ---------------- 口语：和 AI 对话 ---------------- */
  var SPEAK_SCENARIOS = [
    { id: "free", label: "自由聊天", scene: "任何话题，像聊天一样",
      opener: "Hi! How are you today? What did you do this morning?" },
    { id: "airport", label: "机场值机", scene: "你在机场柜台，需要办理值机和托运行李",
      opener: "Good morning! Welcome to the check-in counter. May I see your passport, please?" },
    { id: "customs", label: "海关入境", scene: "你刚下飞机，在海关回答入境问题",
      opener: "Next, please. What is the purpose of your visit?" },
    { id: "hotel", label: "酒店入住", scene: "你在酒店前台办理入住",
      opener: "Good evening! Welcome to our hotel. Do you have a reservation?" },
    { id: "restaurant", label: "餐厅点餐", scene: "你在餐厅点餐、提出忌口、买单",
      opener: "Good evening! A table for how many people?" }
  ];

  function speakingSystemPrompt(scenarioId) {
    var sc = SPEAK_SCENARIOS.filter(function (s) { return s.id === scenarioId; })[0] || SPEAK_SCENARIOS[0];
    return "You are a friendly English conversation partner for a Chinese beginner (A0–A1 level).\n" +
      "Scenario: " + (sc.scene || "") + "\n" +
      "Rules:\n" +
      "1) Always reply in simple, natural English (A1 level), 1–2 short sentences.\n" +
      "2) If the user's message has a grammar or word error, first write one short Chinese line starting with 【纠正】 explaining it, then reply in English.\n" +
      "3) If the user's English is correct, do NOT write any Chinese; just continue the conversation.\n" +
      "4) Always end your English reply with a simple question to keep the conversation going.\n" +
      "5) Never use Chinese inside the English part.";
  }

  // 从 AI 回复里拆出中文纠正和英文正文
  function splitCorrection(text) {
    var t = String(text || "").trim();
    var m = t.match(/^【?纠正】?[:：]?\s*([^\n]*)\n([\s\S]*)$/);
    if (m) return { zh: m[1].trim(), en: m[2].trim() };
    // 也支持 "纠正：" 开头
    var m2 = t.match(/^纠正[:：]\s*([^\n]*)\n([\s\S]*)$/);
    if (m2) return { zh: m2[1].trim(), en: m2[2].trim() };
    return { zh: "", en: t };
  }

  function renderSpeaking() {
    var hist = (state.speaking && state.speaking.history) || [];
    var scenario = (state.speaking && state.speaking.scenario) || "free";

    var html =
      '<div class="card"><h1>口语练习</h1>' +
        '<div class="small muted">用英文跟 AI 聊天。说错会先给你中文提示，再继续聊。回复会自动朗读。</div>' +
        '<div class="row" id="sp-scenarios" style="margin-top:12px">' +
          SPEAK_SCENARIOS.map(function (s) {
            return '<button class="btn' + (s.id === scenario ? " primary" : "") +
              '" data-sp-scenario="' + s.id + '">' + s.label + "</button>";
          }).join("") +
        "</div>" +
        (AI.configured() ? "" :
          '<div class="tiny" style="margin-top:8px;color:var(--warn)">还没配置 AI。去「设置 → AI 批改」填一个 Key 才能对话。</div>') +
      "</div>" +
      '<div class="card">' +
        '<div id="sp-log" class="sp-log"></div>' +
        '<textarea id="sp-input" class="sp-input" rows="3" placeholder="在这里打英文，或点麦克风说…（Enter 发送，Shift+Enter 换行）"></textarea>' +
        '<div class="row" id="sp-input-row" style="margin-top:8px">' +
          '<button class="btn primary" id="sp-send">发送</button>' +
          '<div class="spacer"></div>' +
          '<span class="tiny faint" id="sp-count"></span>' +
        "</div>" +
        '<div class="row" id="sp-extra-row" style="margin-top:8px">' +
          '<button class="btn" id="sp-mic" hidden>🎤 按住说话</button>' +
          '<button class="btn ghost" id="sp-hint">给我个提示</button>' +
          '<button class="btn ghost" id="sp-reset">重开一轮</button>' +
          '<div class="spacer"></div><span class="tiny faint" id="sp-meta"></span>' +
        "</div>" +
      "</div>";

    $("#view-speaking").innerHTML = html;

    var logEl = $("#sp-log");
    var input = $("#sp-input");
    var sendBtn = $("#sp-send");
    var busy = false;

    function scrollLog() {
      var main = document.querySelector("main");
      if (main) main.scrollTop = main.scrollHeight;
    }

    function bubble(role, zh, en) {
      var d = document.createElement("div");
      d.className = "sp-msg " + role;
      var inner = "";
      if (zh) inner += '<div class="sp-zh">' + esc(zh) + "</div>";
      if (en) inner += '<div class="sp-en">' + esc(en) +
        '<button class="say" data-say="' + esc(en) + '">🔊</button></div>';
      d.innerHTML = inner;
      logEl.appendChild(d);
      d.querySelectorAll(".say").forEach(function (b) {
        b.addEventListener("click", function () { tts.speak(b.dataset.say); });
      });
      scrollLog();
      return d;
    }

    function paintHistory() {
      logEl.innerHTML = "";
      if (!hist.length) {
        var sc = SPEAK_SCENARIOS.filter(function (s) { return s.id === scenario; })[0];
        bubble("ai", "", sc ? sc.opener : "Hi! Let us practice English. What would you like to talk about?");
        return;
      }
      hist.forEach(function (m) {
        bubble(m.role === "user" ? "me" : "ai", m.zh || "", m.en || "");
      });
      if (hist.length) scrollLog();
    }

    function saveHist() {
      state.speaking = state.speaking || {};
      state.speaking.history = hist.slice(-40);
      state.speaking.scenario = scenario;
      save();
    }

    function setBusy(v, msg) {
      busy = v;
      sendBtn.disabled = v;
      sendBtn.textContent = v ? "…" : "发送";
      var meta = $("#sp-meta");
      if (meta) meta.textContent = msg || "";
    }

    function send() {
      if (busy) return;
      var text = String(input.value || "").trim();
      if (!text) return;
      if (!AI.configured()) { toast("先去设置里填 AI Key"); return; }

      input.value = "";
      hist.push({ role: "user", en: text, zh: "" });
      bubble("me", "", text);
      saveHist();

      var thinking = bubble("ai", "", "…");
      setBusy(true, "AI 正在回复…");

      var prov = AI.provider();
      var key = String(state.settings.aiKey || "").trim();
      var model = String(state.settings.aiModel || "").trim() || prov.model;
      var msgs = [{ role: "system", content: speakingSystemPrompt(scenario) }];
      hist.slice(-12).forEach(function (m) {
        msgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.en || "" });
      });

      fetch(prov.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({ model: model, messages: msgs, temperature: 0.7, stream: false })
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + "：" + String(t).slice(0, 140)); });
        return r.json();
      }).then(function (d) {
        var out = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
        var parts = splitCorrection(out);
        if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
        bubble("ai", parts.zh, parts.en);
        hist.push({ role: "ai", zh: parts.zh, en: parts.en });
        saveHist();
        if (parts.en) tts.speak(parts.en);
        setBusy(false, "");
      }).catch(function (e) {
        if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
        bubble("ai", "", "(" + String(e.message || e) + ")");
        setBusy(false, "");
      });
    }

    // 场景切换
    $$("[data-sp-scenario]").forEach(function (b) {
      b.addEventListener("click", function () {
        scenario = b.dataset.spScenario;
        hist = [];
        state.speaking = { history: [], scenario: scenario };
        save();
        renderSpeaking();
      });
    });

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener("input", function () {
      var c = $("#sp-count");
      if (c) c.textContent = input.value.length ? (input.value.length + " 字符") : "";
    });

    $("#sp-reset").addEventListener("click", function () {
      hist = [];
      state.speaking = { history: [], scenario: scenario };
      save();
      renderSpeaking();
      toast("已重开");
    });

    $("#sp-hint").addEventListener("click", function () {
      if (!AI.configured()) { toast("先去设置里填 AI Key"); return; }
      var el = $("#sp-hint");
      if (el.disabled) return;
      el.disabled = true;
      el.textContent = "想提示…";
      var last = hist.length ? hist[hist.length - 1].en : "";
      var prov = AI.provider();
      var key = String(state.settings.aiKey || "").trim();
      var model = String(state.settings.aiModel || "").trim() || prov.model;
      fetch(prov.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "你在帮一个 A0-A1 中文母语者练英语口语。" },
            { role: "user", content: "对方最后说：" + (last || "(还没有对话)") +
              "\n请用一句简单英文告诉我该怎么接话，再附一句中文解释。格式：英文句子 | 中文解释" }
          ],
          temperature: 0.5, stream: false
        })
      }).then(function (r) { return r.json(); }).then(function (d) {
        var out = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
        bubble("ai", "提示：" + out, "");
      }).catch(function (e) {
        toast("提示失败：" + e.message);
      }).then(function () {
        el.disabled = false;
        el.textContent = "给我个提示";
      });
    });

    // 语音输入（浏览器支持才显示）
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var micBtn = $("#sp-mic");
    if (SR) {
      micBtn.hidden = false;
      var rec = null, recording = false;
      micBtn.addEventListener("click", function () {
        if (recording) { if (rec) rec.stop(); return; }
        rec = new SR();
        rec.lang = "en-US";
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        recording = true;
        micBtn.textContent = "🎤 听你说…";
        micBtn.classList.add("primary");
        rec.onresult = function (ev) {
          var txt = ev.results[0][0].transcript;
          input.value = txt;
        };
        rec.onerror = function (ev) {
          toast("识别失败：" + ev.error);
        };
        rec.onend = function () {
          recording = false;
          micBtn.textContent = "🎤 按住说话";
          micBtn.classList.remove("primary");
        };
        try { rec.start(); } catch (e) { recording = false; }
      });
    }

    paintHistory();
    if (hist.length) {
      var lastAi = hist.slice().reverse().filter(function (m) { return m.role === "ai"; })[0];
      if (lastAi && lastAi.en && lastAi.en !== "…") tts.speak(lastAi.en);
    }
  }

  function renderWriting() {
    var draft = state.draft || "";
    if (!draft && /(^|[?&])demo=1/.test(location.search)) {
      draft = "Today i go to the airport. I has two bag. The man ask me for my passporr. I don't have no time.";
    }
    $("#view-writing").innerHTML =
      '<div class="card"><h1>写作检查</h1>' +
        '<div class="small muted">先用本地规则抓硬错误（拼写、第三人称单数、冠词、be 动词），再让 AI 逐句批改并给自然说法。</div>' +
        '<textarea id="wr-text" style="min-height:170px;margin-top:12px" placeholder="Today I go to the airport. I have one bag. The man ask me for my passport..."></textarea>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn primary" id="wr-check">本地检查</button>' +
          '<button class="btn" id="wr-ai">AI 批改</button>' +
          '<button class="btn ghost" id="wr-copy">复制提示词</button>' +
          '<button class="btn ghost" id="wr-clear">清空</button>' +
          '<div class="spacer"></div><span class="tiny faint" id="wr-meta"></span>' +
        "</div>" +
        (AI.configured() ? "" :
          '<div class="tiny" style="margin-top:8px;color:var(--warn)">还没配置 AI。去「设置 → AI 批改」填一个 Key，就能直接在这里批改。</div>') +
        "</div>" +
      '<div class="card" id="wr-result"><div class="empty">点「本地检查」或「AI 批改」开始</div></div>' +
      '<div class="card" id="wr-ai-result" hidden></div>';

    var ta = $("#wr-text");
    ta.value = draft;
    ta.addEventListener("input", function () { state.draft = ta.value; save(); });

    function run(text) {
      var r = analyzeText(text);
      renderIssues($("#wr-result"), text, r, function (fixed) {
        ta.value = fixed; state.draft = fixed; save(); run(fixed);
      });
      $("#wr-meta").textContent = text.length + " 字符";
    }
    $("#wr-check").addEventListener("click", function () { run(ta.value); });
    $("#wr-clear").addEventListener("click", function () {
      ta.value = ""; state.draft = ""; save();
      $("#wr-result").innerHTML = '<div class="empty">点「检查」开始</div>';
    });
    $("#wr-copy").addEventListener("click", function () {
      copyText(aiPrompt(ta.value, analyzeText(ta.value)));
    });

    $("#wr-ai").addEventListener("click", function () {
      var btn = this;
      var text = String(ta.value || "").trim();
      if (!text) { toast("先写点内容"); return; }
      if (!AI.configured()) { toast("先去「设置 → AI 批改」填 Key"); return; }
      if (btn.disabled) return;

      var box = $("#wr-ai-result");
      box.hidden = false;
      box.innerHTML = '<div class="small muted">AI 正在批改…</div><div id="wr-ai-body" class="ai-say"></div>';

      btn.disabled = true;
      btn.textContent = "批改中…";

      AI.chat(aiPrompt(text, analyzeText(text)), function (partial) {
        var body = document.getElementById("wr-ai-body");
        if (body) body.textContent = partial;
      }).then(function (out) {
        var body = document.getElementById("wr-ai-body");
        if (body) body.textContent = out || "(AI 没有返回内容)";
        toast("批改完成");
      }).catch(function (e) {
        box.innerHTML = '<div class="small" style="color:var(--bad)">批改失败：' +
          esc(String(e.message || e)) + '</div>';
      }).then(function () {
        btn.disabled = false;
        btn.textContent = "AI 批改";
      });
    });
  }

  /* ---------------- 语法 ---------------- */
  function bindAccordion(scopeSel, attr, cardSel, bodySel) {
    $$(scopeSel + " [" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var key = b.getAttribute(attr);
        openSections[key] = !openSections[key];
        var card = b.closest(cardSel);
        var body = card ? card.querySelector(bodySel) : null;
        if (body) body.hidden = !openSections[key];
        var arrow = b.querySelector(".acc-arrow");
        if (arrow) arrow.textContent = openSections[key] ? "\u25be" : "\u25b8";
      });
    });
  }

  function countWords(text) {
    return (String(text || "").match(/[A-Za-z']+/g) || []).length;
  }

  function bindWritingBoxes(scopeSel) {
    $$(scopeSel + " .writing-box").forEach(function (ta) {
      var id = ta.dataset.write;
      var cnt = $(scopeSel + " [data-count-for='" + id + "']");
      var saved = (state.writing || {})[id];
      if (saved && saved.text) ta.value = saved.text;
      var refresh = function () {
        if (cnt) cnt.textContent = countWords(ta.value) + " 词";
      };
      refresh();
      var timer = null;
      ta.addEventListener("input", function () {
        refresh();
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.writing = state.writing || {};
          state.writing[id] = {
            text: ta.value,
            at: new Date().toISOString().slice(0, 16).replace("T", " ")
          };
          save();
        }, 700);
      });
    });
  }

  /* ---------------- 语法 ---------------- */
  function bindAccordion(scopeSel, attr, cardSel, bodySel) {
    $$(scopeSel + " [" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var key = b.getAttribute(attr);
        openSections[key] = !openSections[key];
        var card = b.closest(cardSel);
        var body = card ? card.querySelector(bodySel) : null;
        if (body) body.hidden = !openSections[key];
        var arrow = b.querySelector(".acc-arrow");
        if (arrow) arrow.textContent = openSections[key] ? "\u25be" : "\u25b8";
      });
    });
  }

  function countWords(text) {
    return (String(text || "").match(/[A-Za-z']+/g) || []).length;
  }

  function bindWritingBoxes(scopeSel) {
    $$(scopeSel + " .writing-box").forEach(function (ta) {
      var id = ta.dataset.write;
      var cnt = $(scopeSel + " [data-count-for='" + id + "']");
      var saved = (state.writing || {})[id];
      if (saved && saved.text) ta.value = saved.text;
      var refresh = function () {
        if (cnt) cnt.textContent = countWords(ta.value) + " 词";
      };
      refresh();
      var timer = null;
      ta.addEventListener("input", function () {
        refresh();
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.writing = state.writing || {};
          state.writing[id] = {
            text: ta.value,
            at: new Date().toISOString().slice(0, 16).replace("T", " ")
          };
          save();
        }, 700);
      });
    });
  }

  /* ---------------- 语法 ---------------- */
  var GRAMMAR_LEVEL_LABEL = {
    A1: "A1 · 入门必须拿下",
    A2: "A2 · 生活里天天用",
    B1: "B1 · 考试写作要用"
  };

  function renderGrammar() {
    var list = EXAM.grammar || [];
    var levels = ["A1", "A2", "B1"];
    var html = '<div class="card"><h1>语法</h1>' +
      '<div class="small muted">12 个核心点，按 A1 → A2 → B1 分组。点标题展开；每点看公式、读例句、跟读一遍。</div></div>';

    levels.forEach(function (lv) {
      var items = list.filter(function (g) { return g.level === lv; });
      if (!items.length) return;
      var lvKey = "gr|" + lv;
      var lvOpen = !!openSections[lvKey];
      html += '<div class="card acc" style="padding:0;overflow:hidden">' +
        '<button class="acc-head" data-acc="' + lvKey + '">' +
          '<span class="acc-arrow">' + (lvOpen ? "\u25be" : "\u25b8") + '</span>' +
          '<span class="acc-title">' + (GRAMMAR_LEVEL_LABEL[lv] || lv) + '</span>' +
          '<span class="badge">' + items.length + ' 个点</span>' +
        '</button>' +
        '<div class="acc-body"' + (lvOpen ? "" : " hidden") + '>';

      items.forEach(function (g) {
        var k = "gr|" + g.id;
        var open = !!openSections[k];
        html += '<div class="subcard">' +
          '<div class="sub-head-row">' +
            '<button class="sub-head" data-sub="' + k + '">' +
              '<span class="acc-arrow">' + (open ? "\u25be" : "\u25b8") + '</span>' +
              '<span class="sub-title">' + esc(g.title) + '</span>' +
            '</button>' +
            '<span class="badge">' + esc(g.level) + '</span>' +
          '</div>' +
          '<div class="sub-body"' + (open ? "" : " hidden") + '>' +
            '<div class="formula">' + esc(g.formula) + '</div>' +
            '<div class="small muted" style="margin:6px 0 10px">' + esc(g.zh) + '</div>' +
            '<div class="list">' +
              (g.ex || []).map(function (e) {
                return '<div class="list-item"><div style="flex:1"><div class="en">' + annotate(e.en) + "</div>" +
                  '<div class="zh">' + esc(e.zh) + "</div></div>" +
                  '<button class="btn ghost" data-say="' + esc(e.en) + '">🔊</button></div>';
              }).join("") +
            '</div>' +
          '</div></div>';
      });
      html += '</div></div>';
    });

    $("#view-grammar").innerHTML = html;
    bindAccordion("#view-grammar", "data-acc", ".acc", ".acc-body");
    bindAccordion("#view-grammar", "data-sub", ".subcard", ".sub-body");
    $$("#view-grammar [data-say]").forEach(function (b) {
      b.addEventListener("click", function () { tts.speak(b.dataset.say); });
    });
  }

  /* ---------------- 通用录音小部件 ---------------- */
  /* 返回 HTML 片段；调用 bindRecorder(容器, 英文) 绑定 */
  function recorderHtml(id) {
    if (!window.Recorder) return "";
    // iOS 上录音不可用，隐藏按钮避免点了报错
    if (Recorder.blockedByPlatform && Recorder.blockedByPlatform()) return "";
    return '<div class="row" style="margin-top:10px;gap:8px" id="' + id + '">' +
      '<button class="btn ghost" data-rec="' + id + '">🎤 跟读录音</button>' +
      '<button class="btn ghost" data-rec-play="' + id + '" hidden>▶ 听自己的</button>' +
      '<button class="btn ghost" data-rec-cmp="' + id + '" hidden>⇄ 对比标准音</button>' +
      '</div>';
  }

  function bindRecorder(scope, text) {
    var box = scope.querySelector("[data-rec]");
    if (!box) return;
    var id = box.dataset.rec;
    var playBtn = scope.querySelector('[data-rec-play="' + id + '"]');
    var cmpBtn = scope.querySelector('[data-rec-cmp="' + id + '"]');
    var url = null;

    box.addEventListener("click", function () {
      if (Recorder.isRecording()) {
        Recorder.stop().then(function (res) {
          url = res.url;
          box.textContent = "🎤 重录";
          if (playBtn) playBtn.hidden = false;
          if (cmpBtn) cmpBtn.hidden = false;
          Recorder.play(url);
        }).catch(function (err) { toast(err.message || "录音失败"); });
        return;
      }
      Recorder.start().then(function () {
        box.textContent = "⏹ 停止录音";
      }).catch(function (err) {
        toast(err.message || "麦克风不可用：请在地址栏允许麦克风权限");
      });
    });

    if (playBtn) playBtn.addEventListener("click", function () { if (url) Recorder.play(url); });
    if (cmpBtn) cmpBtn.addEventListener("click", function () {
      if (!url) return;
      tts.speak(text, { onend: function () { setTimeout(function () { Recorder.play(url); }, 400); } });
    });
  }

  /* ---------------- 单词详情弹层 ---------------- */
  function showWordDetail(key) {
    var it = null;
    REGISTRY.forEach(function (r) { if (r.key === key) it = r; });
    if (!it) { toast("找不到这个词"); return; }

    var rec = state.srs[key];
    var weak = (state.weak || {})[key];

    // 出现在哪些分组
    var groups = [];
    REGISTRY.forEach(function (r) {
      if (r.en.toLowerCase() === it.en.toLowerCase() && groups.indexOf(r.groupTitle) < 0) groups.push(r.groupTitle);
    });

    var srsHtml = rec
      ? '<div class="row" style="gap:8px;flex-wrap:wrap">' +
          '<span class="badge ok">第 ' + ((rec.box || 0) + 1) + ' 档</span>' +
          '<span class="badge">学过 ' + (rec.seen || 0) + ' 次</span>' +
          (rec.lapses ? '<span class="badge warn">忘了 ' + rec.lapses + ' 次</span>' : '') +
          (rec.done ? '<span class="badge ok">已掌握</span>' : '<span class="badge">下次 ' + esc(rec.due || "-") + '</span>') +
        '</div>'
      : '<div class="tiny faint">还没学过这个词</div>';

    var html =
      '<div class="overlay" id="detail-overlay">' +
        '<div class="detail-card">' +
          '<div class="row">' +
            '<div style="flex:1">' +
              '<div class="big en" style="font-size:30px">' + esc(it.en) + '</div>' +
              ipaHtml(it.en) +
            '</div>' +
            '<button class="btn ghost" id="detail-close">✕</button>' +
          '</div>' +
          '<div class="zh" style="font-size:16px;margin-top:6px">' + esc(it.zh) + '</div>' +
          (it.ex ? '<div class="ex" style="margin-top:12px">' + annotate(it.ex) + '</div>' : '') +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="detail-say">🔊 朗读单词</button>' +
            (it.ex ? '<button class="btn ghost" id="detail-say-ex">🔊 朗读例句</button>' : '') +
          '</div>' +
          '<h4 style="margin:18px 0 8px">学习状态</h4>' +
          srsHtml +
          (weak ? '<div class="tiny" style="margin-top:8px;color:var(--warn)">在待巩固里（错 ' + (weak.count || 1) + ' 次）</div>' : '') +
          '<h4 style="margin:18px 0 8px">出现在</h4>' +
          '<div class="row" style="gap:6px;flex-wrap:wrap">' +
            groups.map(function (g) { return '<span class="badge">' + esc(g) + '</span>'; }).join("") +
          '</div>' +
        '</div>' +
      '</div>';

    var host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host.firstChild);

    function close() {
      var el = $("#detail-overlay");
      if (el) el.remove();
      document.onkeydown = null;
    }
    $("#detail-close").addEventListener("click", close);
    $("#detail-overlay").addEventListener("click", function (e) {
      if (e.target.id === "detail-overlay") close();
    });
    $("#detail-say").addEventListener("click", function () { tts.speak(it.en); });
    var sayEx = $("#detail-say-ex");
    if (sayEx) sayEx.addEventListener("click", function () { tts.speak(it.ex); });
    document.onkeydown = function (e) { if (e.key === "Escape") close(); };
  }

  /* ---------------- 听写 ---------------- */
  function dictationPool() {
    var pool = [];
    // 高频词的例句
    CORE.forEach(function (b) {
      (b.words || []).forEach(function (r) {
        var ex = (r[2] || "").trim();
        if (ex && (ex.match(/[A-Za-z']+/g) || []).length >= 3) {
          pool.push({ en: ex, zh: r[1] || "", word: r[0], zhType: "word" });
        }
      });
    });
    // 场景影子跟读句
    DATA.scenarios.forEach(function (sc) {
      (sc.shadow || []).forEach(function (s) {
        if (s.en && (s.en.match(/[A-Za-z']+/g) || []).length >= 3) {
          pool.push({ en: s.en, zh: s.zh || "", word: sc.title, zhType: "sentence" });
        }
      });
    });
    return pool;
  }

  function normWords(s) {
    return String(s || "").toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-z0-9' ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /* 逐词对比：返回 [{w, ok}] 以原文为准 */
  function compareWords(answer, target) {
    var a = normWords(answer), t = normWords(target);
    var out = [], hit = 0;
    // 简易 LCS 对齐，保证多词/漏词能对上
    var m = a.length, n = t.length;
    var dp = [];
    for (var i = 0; i <= m; i++) { dp.push(new Array(n + 1).fill(0)); }
    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === t[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    var i = m, j = n, marks = [];
    while (i > 0 && j > 0) {
      if (a[i - 1] === t[j - 1]) { marks[j - 1] = "ok"; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { i--; }
      else { j--; }
    }
    t.forEach(function (w, k) {
      var ok = marks[k] === "ok";
      if (ok) hit++;
      out.push({ w: w, ok: ok });
    });
    return { words: out, hit: hit, total: t.length, ratio: t.length ? hit / t.length : 0 };
  }

  function renderDictation() {
    var pool = dictationPool();
    var roundSize = 10;
    var queue = [];
    var pos = 0;
    var totalHit = 0, totalWords = 0;
    var speed = state.settings.dictSpeed || 1.0;
    var answered = false;
    var draftByPos = {};   // 每句保留用户输入，切上一句/下一句回来还在
    var scoreByPos = {};   // 每句已计入的成绩，重算时先扣除
    var answeredByPos = {}; // 哪些句子已经翻开过答案，切回来保持翻开

    function pick() {
      var copy = pool.slice();
      for (var i = copy.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
      }
      queue = copy.slice(0, Math.min(roundSize, copy.length));
      pos = 0; totalHit = 0; totalWords = 0; draftByPos = {}; scoreByPos = {}; answeredByPos = {};
    }

    var dir = 0;   // -1 = 上一句（左翻），1 = 下一句（右翻）

    function go(step) {
      var next = pos + step;
      if (next < 0) return;
      dir = step;
      pos = next;
      answered = !!answeredByPos[pos];
      draw();
    }

    function draw() {
      if (!queue.length) {
        $("#view-dictation").innerHTML = '<div class="card"><h1>听写</h1><div class="empty">没有可用的句子素材</div></div>';
        return;
      }
      if (pos >= queue.length) {
        var pct = totalWords ? Math.round(totalHit / totalWords * 100) : 0;
        $("#view-dictation").innerHTML =
          '<div class="card"><h1>听写</h1>' +
            '<div class="empty">这一轮结束<br><b style="font-size:30px">' + pct + '%</b> 词准确率<br>' +
            '<span class="tiny">共 ' + queue.length + ' 句 · 对了 ' + totalHit + ' / ' + totalWords + ' 个词</span></div>' +
            '<div class="row" style="justify-content:center;margin-top:12px">' +
              '<button class="btn primary" id="dict-again">再来一轮</button>' +
            '</div></div>';
        $("#dict-again").addEventListener("click", function () { dir = 0; pick(); answered = false; draw(); });
        return;
      }
      var q = queue[pos];
      answered = !!answeredByPos[pos];
      // 盖住状态一律用虚线；只有真的翻开时才是实线答案页
      var frontStyle = answered ? "" : " style=\"border-style:dashed\"";
      var enterCls = dir === 1 ? " enter-right" : (dir === -1 ? " enter-left" : "");

      var zhLine = q.zhType === "sentence"
        ? esc(q.zh || "")
        : ("关键词 " + esc(q.word || "") + "：" + esc(q.zh || ""));

      $("#view-dictation").innerHTML =
        '<div class="card"><h1>听写</h1>' +
          '<div class="muted small">听一句英文，把听到的写下来。写完点下面的「📖 回答」翻面看答案。</div>' +

          '<div class="dict-flip' + (answered ? " flipped" : "") + enterCls + '" id="dict-flip">' +
            '<div class="dict-flip-inner" id="dict-flip-inner">' +
              '<div class="dict-flip-face dict-flip-front"' + frontStyle + '>' +
                '<div class="dict-lock">🔒</div>' +
                '<div class="tiny faint">答案已盖住 · 点下方「📖 回答」翻面</div>' +
              '</div>' +
              '<div class="dict-flip-face dict-flip-back" id="dict-back"></div>' +
            '</div>' +
          '</div>' +

          // 播放行
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn primary" id="dict-play">▶ 播放</button>' +
            '<button class="btn ghost" id="dict-slow">🐢 慢放 0.6×</button>' +
            '<div class="spacer"></div>' +
            '<span class="tiny faint">语速</span>' +
            [0.6, 0.8, 1].map(function (s) {
              return '<button class="btn' + (Math.abs(speed - s) < 0.01 ? " primary" : "") +
                '" data-dspeed="' + s + '">' + s + '×</button>';
            }).join("") +
          '</div>' +

          // 写答案
          '<textarea id="dict-input" rows="4" style="margin-top:12px;width:100%" ' +
            'placeholder="听到什么写什么，听不清就多听几遍…"></textarea>' +

          // 回答 / 上一句 / 下一句（放在写答案的下面）
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn primary" id="dict-answer-btn">📖 回答</button>' +
            '<button class="btn ghost" id="dict-prev"' + (pos > 0 ? "" : " disabled") + '>← 上一句</button>' +
            '<button class="btn ghost" id="dict-next">下一句 →</button>' +
            '<div class="spacer"></div>' +
            '<span class="tiny faint">' + (pos + 1) + " / " + queue.length + '</span>' +
          '</div>' +
        '</div>';

      var input = $("#dict-input");
      if (draftByPos[pos] != null) input.value = draftByPos[pos];
      var flip = $("#dict-flip");
      var back = $("#dict-back");
      // 已经作答过的句子：回来时保持翻开，并恢复答案
      if (answered) {
        flip.classList.add("no-anim");
        flip.classList.add("flipped");
        fillBack();
      }

      function play(rate) { tts.speak(q.en, { rate: rate || speed }); }
      $("#dict-play").addEventListener("click", function () { play(speed); });
      $("#dict-slow").addEventListener("click", function () { play(0.6); });
      $$("#view-dictation [data-dspeed]").forEach(function (b) {
        b.addEventListener("click", function () {
          speed = Number(b.dataset.dspeed);
          state.settings.dictSpeed = speed; save();
          dir = 0; draw();
        });
      });
      $("#dict-next").addEventListener("click", function () { go(1); });
      $("#dict-prev").addEventListener("click", function () { go(-1); });

      function fillBack() {
        var res = compareWords(input.value, q.en);
        var calc = scoreByPos[pos];
        var pct = calc && calc.total ? Math.round(calc.hit / calc.total * 100) : (res.total ? Math.round(res.ratio * 100) : 0);
        back.innerHTML =
          '<div class="dict-ans-main">' +
            '<div class="dict-sentence">' + annotate(q.en) + '</div>' +
            '<div class="dict-zh">' + zhLine + '</div>' +
          '</div>' +
          '<div class="dict-ans-foot">' +
            '<div class="row dict-words">' +
              res.words.map(function (w) {
                return '<span class="dw ' + (w.ok ? "ok" : "bad") + '">' + esc(w.w) + '</span>';
              }).join(" ") +
            '</div>' +
            '<div class="row" style="margin-top:6px;align-items:center">' +
              '<span class="badge ' + (pct >= 90 ? "ok" : (pct >= 60 ? "" : "warn")) + '">' + pct + '% 准确</span>' +
              '<span class="tiny faint">对了 ' + res.hit + ' / ' + res.total + ' 个词</span>' +
            '</div>' +
          '</div>';
      }

      function reveal() {
        if (answered) { flip.classList.toggle("flipped"); return; }
        answered = true;
        answeredByPos[pos] = true;
        totalHit -= scoreByPos[pos] ? scoreByPos[pos].hit : 0;
        totalWords -= scoreByPos[pos] ? scoreByPos[pos].total : 0;
        var res = compareWords(input.value, q.en);
        scoreByPos[pos] = { hit: res.hit, total: res.total };
        totalHit += res.hit;
        totalWords += res.total;
        fillBack();
        flip.classList.add("flipped");
      }
      $("#dict-answer-btn").addEventListener("click", reveal);

      // 输入内容随时保存，切走再回来还在；已翻面时边输入边更新对错
      input.addEventListener("input", function () {
        draftByPos[pos] = input.value;
        if (answered) {
          totalHit -= scoreByPos[pos] ? scoreByPos[pos].hit : 0;
          totalWords -= scoreByPos[pos] ? scoreByPos[pos].total : 0;
          var r = compareWords(input.value, q.en);
          scoreByPos[pos] = { hit: r.hit, total: r.total };
          totalHit += r.hit;
          totalWords += r.total;
          fillBack();
        }
      });

      input.addEventListener("keydown", function (e) {
        // 回车直接翻面看答案；Shift+回车保留换行
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          reveal();
        }
      });

      // 全局左右键切句：即使光标在书写区也用 Ctrl(或 Alt)+左/右，避免和移动光标冲突
      document.onkeydown = function (e) {
        var inField = e.target && /textarea|input/i.test(e.target.tagName);
        if (e.altKey || (inField && e.ctrlKey)) {
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); return; }
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); return; }
        }
        if (inField) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        else if (e.code === "Space") { e.preventDefault(); reveal(); }
      };

      setTimeout(function () {
        // 播放不应重绘画布，避免虚线框重新播放入场动画
        play(speed);
      }, 200);

      // 换句后光标直接落在书写区，可以马上打字
      // （延迟一点，等入场动画结束、元素可聚焦）
      setTimeout(function () {
        var box = $("#dict-input");
        if (!box) return;
        try {
          box.focus({ preventScroll: true });
          var len = box.value.length;
          box.setSelectionRange(len, len);
        } catch (err) {
          box.focus();
        }
      }, dir === 0 ? 0 : 60);
    }

    pick();
    draw();
  }

  /* ---------------- 考试 ---------------- */
  var EXAM_BLUEPRINT = {
    ielts: {
      name: "IELTS 雅思",
      total: "约 2 小时 45 分",
      parts: [
        { id: "listening", title: "① 听力 Listening", meta: "30 分钟 · 4 Section · 40 题", items: [
          "Section 1　日常对话：填表 / 填空（住宿、订票、登记）",
          "Section 2　独白：地图标注、选择题",
          "Section 3　学术讨论：多选、匹配题",
          "Section 4　学术讲座：填空（只念一遍）"
        ] },
        { id: "reading", title: "② 阅读 Reading", meta: "60 分钟 · 3 篇 · 40 题", items: [
          "True / False / Not Given",
          "Matching headings（段落标题匹配）",
          "Matching information（信息定位）",
          "Summary completion（摘要填空）",
          "Multiple choice（多选）"
        ] },
        { id: "writing", title: "③ 写作 Writing", meta: "60 分钟 · Task 1 + Task 2" },
        { id: "speaking", title: "④ 口语 Speaking", meta: "11–14 分钟 · 3 个 Part" }
      ]
    },
    toefl: {
      name: "TOEFL 托福",
      total: "约 2 小时",
      parts: [
        { id: "reading", title: "① 阅读 Reading", meta: "35 分钟 · 2 篇 · 20 题", items: [
          "事实信息题 / 否定事实题",
          "推断题、修辞目的题",
          "词汇题、句子简化题",
          "插入文本题、篇章小结题"
        ] },
        { id: "listening", title: "② 听力 Listening", meta: "36 分钟 · 2 对话 + 3 讲座 · 28 题", items: [
          "对话：目的题、态度题、细节题",
          "讲座：主旨、细节、推断、重听题"
        ] },
        { id: "speaking", title: "③ 口语 Speaking", meta: "16 分钟 · 4 个 Task" },
        { id: "writing", title: "④ 写作 Writing", meta: "29 分钟 · 2 个 Task" }
      ]
    }
  };

  function writingBox(id, rows, placeholder) {
    return '<textarea class="writing-box" data-write="' + id + '" rows="' + (rows || 9) +
      '" placeholder="' + esc(placeholder) + '"></textarea>' +
      '<div class="row" style="margin-top:8px">' +
        '<span class="tiny faint" data-count-for="' + id + '">0 词</span>' +
        '<span class="tiny faint">· 自动保存</span>' +
      '</div>';
  }

  function subBlock(id, title, meta, bodyHtml) {
    var k = "ex|" + id;
    var open = !!openSections[k];
    return '<div class="subcard">' +
      '<div class="sub-head-row">' +
        '<button class="sub-head" data-sub="' + k + '">' +
          '<span class="acc-arrow">' + (open ? "\u25be" : "\u25b8") + '</span>' +
          '<span class="sub-title">' + esc(title) + '</span>' +
        '</button>' +
        '<span class="badge">' + esc(meta) + '</span>' +
      '</div>' +
      '<div class="sub-body"' + (open ? "" : " hidden") + '>' + bodyHtml + '</div>' +
    '</div>';
  }

  function ieltsWritingInner(ex) {
    var w = ex.writing || [];
    var t1 = w.filter(function (x) { return x.task.indexOf("Task 1") === 0; });
    var t2 = w.filter(function (x) { return x.task.indexOf("Task 2") === 0; });

    function promptsHtml(items) {
      return items.map(function (x) {
        return '<div style="background:var(--surface-3);border-radius:12px;padding:12px;margin:8px 0">' +
          '<div class="small"><b>' + esc(x.task) + '</b></div>' +
          '<div class="tiny faint" style="margin:6px 0">结构：' + x.structure.map(esc).join(" → ") + '</div>' +
          x.frames.map(function (f) {
            return '<div style="margin:6px 0"><div class="en small">' + annotate(f.en) + "</div>" +
              '<div class="tiny faint">' + esc(f.zh) +
              ' <button class="btn ghost tiny" data-say="' + esc(f.en) + '">🔊</button>' +
              ' <button class="btn ghost tiny" data-copy="' + esc(f.en) + '">复制</button></div></div>';
          }).join("") +
          '</div>';
      }).join("");
    }

    return subBlock("ielts-t1", "Task 1 · 图表描述", "≥150 词 · 20 分钟",
        promptsHtml(t1) + writingBox("ielts-t1", 8, "Write at least 150 words. 一句概述 + 两段数据对比 + 一句总结。")) +
      subBlock("ielts-t2", "Task 2 · 议论文", "≥250 词 · 40 分钟",
        promptsHtml(t2) + writingBox("ielts-t2", 12, "Write at least 250 words. 立场 → 理由1 → 理由2 → 让步 → 结论。"));
  }

  function ieltsSpeakingInner(ex) {
    var s = ex.speaking || {};
    var out = '<div class="tiny faint" style="margin:4px 0 8px">Part 1 · 日常问答（点句子朗读）</div>' +
      '<div class="options">' + (s.part1 || []).map(function (q) {
        return '<button class="option" data-say="' + esc(q) + '">' + esc(q) + "</button>";
      }).join("") + "</div>" +
      '<div class="tiny faint" style="margin:14px 0 8px">Part 2 · 题卡（1 分钟准备 + 2 分钟独白）</div>' +
      (s.part2 || []).map(function (c) {
        return '<div class="list-item" style="display:block"><div class="en small">' + esc(c.card) + "</div>" +
          '<div class="tiny faint">' + c.points.map(esc).join(" · ") + "</div></div>";
      }).join("") +
      '<div class="tiny faint" style="margin:14px 0 8px">Part 3 · 抽象讨论</div>' +
      '<div class="options">' + (s.part3 || []).map(function (q) {
        return '<button class="option" data-say="' + esc(q) + '">' + esc(q) + "</button>";
      }).join("") + "</div>";
    return out;
  }

  function toeflWritingInner(ex) {
    var w = ex.writing || [];
    var integrated = w.filter(function (x) { return x.task.indexOf("综合") >= 0; })[0];
    var independent = w.filter(function (x) { return x.task.indexOf("综合") < 0; });

    return subBlock("toefl-int", "Integrated 综合写作", "20 分钟 · 150–225 词",
        '<div class="small muted" style="margin:8px 0">' + esc(integrated ? integrated.prompt : "") + "</div>" +
        writingBox("toefl-int", 10, "Summarise the lecture and contrast it with the reading. 150–225 words.")) +
      subBlock("toefl-disc", "Academic Discussion 学术讨论", "10 分钟 · ≥100 词",
        '<div class="small muted" style="margin:8px 0">教授发帖 + 两位同学回复，你要在讨论区表明观点并给出理由。</div>' +
        writingBox("toefl-disc", 8, "Write at least 100 words: your view + one reason + one example.")) +
      subBlock("toefl-ind", "独立写作旧题（考前练手感）", independent.length + " 题",
        independent.map(function (x, i) {
          return '<div class="list-item" style="display:block"><div class="small">' + (i + 1) + ". " + esc(x.prompt) + "</div></div>";
        }).join(""));
  }

  function toeflSpeakingInner(ex) {
    return (ex.speaking || []).map(function (s, i) {
      return '<div class="list-item" style="display:block">' +
        '<div class="small"><b>' + esc(s.task) + "</b> · " + s.seconds + " 秒</div>" +
        '<div class="tiny faint" style="margin-top:4px">' + esc(s.prompt) + "</div></div>";
    }).join("");
  }

  function renderExam() {
    var ex = EXAM.exam || {};
    var html = '<div class="card"><h1>考试模块</h1>' +
      '<div class="small muted">按真实考试顺序排好。点「雅思」「托福」展开，再点各科看题型；写作区可以直接写，自动保存。</div></div>';

    function examCard(key, spec, innerOf) {
      var open = !!openSections[key];
      var out = '<div class="card acc" style="padding:0;overflow:hidden">' +
        '<button class="acc-head" data-acc="' + key + '">' +
          '<span class="acc-arrow">' + (open ? "\u25be" : "\u25b8") + '</span>' +
          '<span class="acc-title">' + esc(spec.name) + '</span>' +
          '<span class="badge">' + esc(spec.total) + '</span>' +
        '</button>' +
        '<div class="acc-body"' + (open ? "" : " hidden") + '>';
      spec.parts.forEach(function (part) {
        var inner = innerOf(part);
        var k = "ex|" + part.id;
        var pOpen = !!openSections[k];
        out += '<div class="subcard">' +
          '<div class="sub-head-row">' +
            '<button class="sub-head" data-sub="' + k + '">' +
              '<span class="acc-arrow">' + (pOpen ? "\u25be" : "\u25b8") + '</span>' +
              '<span class="sub-title">' + esc(part.title) + '</span>' +
            '</button>' +
            '<span class="badge">' + esc(part.meta) + '</span>' +
          '</div>' +
          '<div class="sub-body"' + (pOpen ? "" : " hidden") + '>' +
            (inner || (part.items || []).map(function (it) {
              return '<div class="small" style="margin:6px 0">' + esc(it) + '</div>';
            }).join("")) +
          '</div></div>';
      });
      out += '</div></div>';
      return out;
    }

    html += examCard("ex|ielts", EXAM_BLUEPRINT.ielts, function (part) {
      if (part.id === "writing") return ieltsWritingInner(ex.ielts || {});
      if (part.id === "speaking") return ieltsSpeakingInner(ex.ielts || {});
      return null;
    });

    html += examCard("ex|toefl", EXAM_BLUEPRINT.toefl, function (part) {
      if (part.id === "writing") return toeflWritingInner(ex.toefl || {});
      if (part.id === "speaking") return toeflSpeakingInner(ex.toefl || {});
      return null;
    });

    $("#view-exam").innerHTML = html;
    bindAccordion("#view-exam", "data-acc", ".acc", ".acc-body");
    bindAccordion("#view-exam", "data-sub", ".subcard", ".sub-body");
    $$("#view-exam [data-say]").forEach(function (b) {
      b.addEventListener("click", function () { tts.speak(b.dataset.say); });
    });
    $$("#view-exam [data-copy]").forEach(function (b) {
      b.addEventListener("click", function () { copyText(b.dataset.copy); });
    });
    bindWritingBoxes("#view-exam");
  }

  /* ---------------- 进度 ---------------- */
  function renderStats() {
    var totalDays = Object.keys(state.days).filter(hasAnyDone).length;
    var totalMin = 0;
    Object.keys(state.days).forEach(function (k) { totalMin += state.days[k].minutes || 0; });
    var last14 = [];
    for (var i = 13; i >= 0; i--) last14.push(addDays(todayKey(), -i));

    var html = '<div class="card"><h1>进度</h1>' +
      '<div class="stats-strip">' +
        '<div class="stat"><div class="num">' + streak() + '</div><div class="lbl">连续天数</div></div>' +
        '<div class="stat"><div class="num">' + totalDays + '</div><div class="lbl">学习天数</div></div>' +
        '<div class="stat"><div class="num">' + totalMin + '</div><div class="lbl">累计分钟</div></div>' +
        '<div class="stat"><div class="num">' + learnedWordCount() + '</div><div class="lbl">单词</div></div>' +
        '<div class="stat"><div class="num">' + Object.keys(state.patterns).length + '</div><div class="lbl">句型</div></div>' +
        '<div class="stat"><div class="num">' + state.sentences.length + '</div><div class="lbl">造句</div></div>' +
      '</div></div>';

    // ---- 最近 14 天柱状图（按分钟高度）----
    var maxMin = 1;
    last14.forEach(function (k) { maxMin = Math.max(maxMin, (state.days[k] && state.days[k].minutes) || 0); });
    var target = state.settings.minutesTarget || 60;
    html += '<div class="card"><h3>最近 14 天</h3>' +
      '<div class="row bars" style="gap:6px;align-items:flex-end;height:110px">' +
      last14.map(function (k) {
        var mins = (state.days[k] && state.days[k].minutes) || 0;
        var h = mins ? Math.max(6, Math.round(mins / maxMin * 90)) : 3;
        var met = mins >= target;
        return '<div title="' + k + '：' + mins + ' 分钟" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">' +
          '<div style="height:' + h + 'px;border-radius:5px;background:' +
          (met ? "var(--ok)" : (mins ? "var(--brand)" : "var(--surface-3)")) +
          ';opacity:' + (mins ? ".9" : ".45") + '"></div>' +
          '<div class="tiny faint" style="text-align:center;font-size:9px;margin-top:3px">' + k.slice(8) + '</div>' +
          '</div>';
      }).join("") + "</div>" +
      '<div class="tiny faint" style="margin-top:10px">绿色 = 达成目标 ' + target + ' 分钟 · 蓝色 = 有学习未达标 · 灰色 = 没学</div></div>';

    // ---- 本周统计 ----
    var weekDays = last14.slice(-7);
    var weekTotal = 0, weekActive = 0;
    weekDays.forEach(function (k) {
      var m = (state.days[k] && state.days[k].minutes) || 0;
      weekTotal += m;
      if (m > 0) weekActive++;
    });
    var weekAvg = weekActive ? Math.round(weekTotal / weekActive) : 0;

    // ---- 分阶段时长 ----
    var stageNames = { shadow: "影子跟读", patterns: "句型打磨", words: "场景单词", output: "开口输出", retest: "每日收尾" };
    var stageTotals = {};
    Object.keys(state.days).forEach(function (k) {
      var bs = state.days[k].byStage;
      if (!bs) return;
      Object.keys(bs).forEach(function (s) { stageTotals[s] = (stageTotals[s] || 0) + bs[s]; });
    });
    var stageKeys = Object.keys(stageTotals).sort(function (x, y) { return stageTotals[y] - stageTotals[x]; });
    var stageMax = 1;
    stageKeys.forEach(function (k) { stageMax = Math.max(stageMax, stageTotals[k]); });

    html += '<div class="card"><h3>本周</h3>' +
      '<div class="stats-strip">' +
        '<div class="stat"><div class="num">' + weekActive + '</div><div class="lbl">学习天数</div></div>' +
        '<div class="stat"><div class="num">' + weekTotal + '</div><div class="lbl">总分钟</div></div>' +
        '<div class="stat"><div class="num">' + weekAvg + '</div><div class="lbl">日均（学习日）</div></div>' +
        '<div class="stat"><div class="num">' + Math.round(weekAvg / target * 100) + '%</div><div class="lbl">目标完成度</div></div>' +
      '</div>' +
      '<div class="tiny faint" style="margin-top:10px">每日目标 ' + target + ' 分钟，可在「设置」里改。</div></div>';

    if (stageKeys.length) {
      html += '<div class="card"><h3>各阶段累计时长</h3><div class="list">' +
        stageKeys.map(function (s) {
          var v = stageTotals[s];
          var w = Math.round(v / stageMax * 100);
          return '<div class="list-item" style="display:block">' +
            '<div class="row" style="margin-bottom:6px">' +
              '<span style="flex:1">' + (stageNames[s] || s) + '</span>' +
              '<span class="badge">' + v + ' 分钟</span></div>' +
            '<div class="progress-line"><i style="width:' + w + '%"></i></div></div>';
        }).join("") + '</div>' +
        '<div class="tiny faint" style="margin-top:8px">旧数据没有分阶段记录，只统计此版本之后的学习。</div></div>';
    }

    html += '<div class="card"><h3>我的造句</h3>' +
      (state.sentences.length
        ? '<div class="list">' + state.sentences.slice(-12).reverse().map(function (s) {
            return '<div class="list-item"><div style="flex:1"><div class="en">' + esc(s.text) + '</div>' +
              '<div class="zh">' + esc(s.at) + " · " + esc(s.pattern || "") + "</div></div></div>";
          }).join("") + "</div>"
        : '<div class="empty">还没有造句记录</div>') + "</div>";

    // ---- 今天已学（可展开查看） ----
    var todayK = todayKey();
    var todayWords = [];
    REGISTRY.forEach(function (it) {
      var r = state.srs[it.key];
      if (r && r.last === todayK) todayWords.push(it);
    });
    var todayPatterns = [];
    DATA.scenarios.forEach(function (sc) {
      (sc.patterns || []).forEach(function (p, i) {
        if (state.patterns[sc.id + "|" + i] === todayK) {
          todayPatterns.push({ en: p.en, zh: p.zh, scene: sc.title });
        }
      });
    });
    var todaySentences = (state.sentences || []).filter(function (s) { return s.at === todayK; });

    html += '<div class="card"><h3 style="margin-bottom:10px">今天已学（点开查看）</h3>' +
      '<details class="today-box"><summary>单词 <b>' + todayWords.length + '</b> 个</summary>' +
        (todayWords.length
          ? '<div class="list" style="margin-top:10px">' + todayWords.map(function (w) {
              return '<div class="list-item"><div style="flex:1"><div class="en">' + esc(w.en) + '</div>' +
                '<div class="zh">' + esc(w.zh) + (w.ex ? " · " + esc(w.ex) : "") + '</div></div>' +
                '<span class="badge ok">第 ' + ((state.srs[w.key].box || 0) + 1) + ' 档</span>' +
                '<button class="btn ghost" data-say="' + esc(w.en) + '">🔊</button></div>';
            }).join("") + '</div>'
          : '<div class="empty">今天还没背单词</div>') +
      '</details>' +
      '<details class="today-box"><summary>句型 <b>' + todayPatterns.length + '</b> 个</summary>' +
        (todayPatterns.length
          ? '<div class="list" style="margin-top:10px">' + todayPatterns.map(function (p) {
              return '<div class="list-item"><div style="flex:1"><div class="en">' + annotate(p.en) + '</div>' +
                '<div class="zh">' + esc(p.zh) + " · " + esc(p.scene) + '</div></div>' +
                '<button class="btn ghost" data-say="' + esc(p.en) + '">🔊</button></div>';
            }).join("") + '</div>'
          : '<div class="empty">今天还没练句型</div>') +
      '</details>' +
      '<details class="today-box"><summary>造句 <b>' + todaySentences.length + '</b> 条</summary>' +
        (todaySentences.length
          ? '<div class="list" style="margin-top:10px">' + todaySentences.slice().reverse().map(function (s) {
              return '<div class="list-item" style="display:block"><div class="en">' + esc(s.text) + '</div>' +
                '<div class="zh">' + esc(s.pattern || "") + '</div></div>';
            }).join("") + '</div>'
          : '<div class="empty">今天还没造句</div>') +
      '</details></div>';

    // ---- 未完成的学习 ----
    var sess = (state.sessions || {})["words"];
    if (sess && sess.at === todayK && sess.keys && sess.keys.length) {
      html += '<div class="card"><h3>上次没学完</h3>' +
        '<div class="small muted" style="margin-bottom:10px">场景单词停在 ' + ((sess.pos || 0) + 1) + " / " + sess.keys.length + ' 张。</div>' +
        '<div class="row"><button class="btn primary" id="resume-words">接着上次继续</button></div></div>';
    }

    html += '<div class="card"><h3>数据</h3><div class="row">' +
      '<button class="btn" id="export">导出进度</button>' +
      '<button class="btn" id="import">导入进度</button>' +
      '<input type="file" id="import-file" accept=".json" style="display:none">' +
      '<div class="spacer"></div><span class="tiny faint">数据只存在这台电脑的浏览器里</span></div></div>';

    $("#view-stats").innerHTML = html;

    $$("#view-stats [data-say]").forEach(function (b) {
      b.addEventListener("click", function () { tts.speak(b.dataset.say); });
    });
    var resumeBtn = $("#resume-words");
    if (resumeBtn) resumeBtn.addEventListener("click", function () {
      go("today");
      openStage("words");
    });

    $("#export").addEventListener("click", function () {
      var text = JSON.stringify(state, null, 2);
      var name = "EasyStudy进度-" + todayKey() + ".json";
      // 桌面版：弹原生「另存为」，自己选位置
      if (window.DesktopFile && DesktopFile.available()) {
        DesktopFile.saveText(name, text).then(function (res) {
          if (!res) { fallbackDownload(text, name); return; }
          if (res.canceled) return;
          if (res.ok) toast("已保存到：" + res.path);
          else toast("保存失败：" + (res.error || "").slice(0, 60));
        });
        return;
      }
      fallbackDownload(text, name);
    });
    $("#import").addEventListener("click", function () { $("#import-file").click(); });
    $("#import-file").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(r.result);
          if (!obj || typeof obj !== "object") throw new Error("格式不对");
          state = obj;
          save();
          toast("已导入");
          go("stats");
        } catch (err) { toast("导入失败：" + err.message); }
      };
      r.readAsText(f);
    });
  }

  /* ---------------- 设置 ---------------- */
  var ACCENTS = [
    { id: "en-US", label: "美音" },
    { id: "en-GB", label: "英音" },
    { id: "en-AU", label: "澳音" },
    { id: "any", label: "不分口音" }
  ];

  var EDGE_VOICES = [
    { id: "en-US-AriaNeural", label: "Aria · 女声（推荐）" },
    { id: "en-US-JennyNeural", label: "Jenny · 女声" },
    { id: "en-US-EmmaNeural", label: "Emma · 女声" },
    { id: "en-US-GuyNeural", label: "Guy · 男声" },
    { id: "en-US-DavisNeural", label: "Davis · 男声" },
    { id: "en-US-AndrewNeural", label: "Andrew · 男声" }
  ];

  function voiceSectionHtml(voices) {
    // 桌面版：edge-tts 音色
    if (window.pywebview && window.pywebview.api && window.pywebview.api.speak) {
      var cur = state.settings.edgeVoice || "en-US-AriaNeural";
      return '<div class="tiny" style="margin-bottom:8px">桌面版使用微软 <b>edge-tts 在线美音</b>（自然语音，需联网；失败自动退回系统语音）。</div>' +
        '<select id="voice-select">' +
          EDGE_VOICES.map(function (v) {
            return '<option value="' + v.id + '"' + (cur === v.id ? " selected" : "") + ">" + v.label + " · en-US</option>";
          }).join("") +
        "</select>" +
        '<div class="row" style="margin-top:10px"><button class="btn" id="test-voice">试听一句</button></div>';
    }
    // 网页版 / 手机版：自然语音包音色选择
    if (audioPack.ready || audioPack.meta) {
      var curPack = state.settings.packVoice || "aria";
      return '<div class="tiny" style="margin-bottom:10px">使用内置<b>微软神经语音包</b>（已下载到本机，离线也能读）。</div>' +
        '<div class="row" id="pack-voice-row">' +
          PACK_VOICES.map(function (v) {
            return '<button class="btn' + (curPack === v.id ? " primary" : "") +
              '" data-pack-voice="' + v.id + '">' + v.label + "</button>";
          }).join("") +
        "</div>" +
        '<div class="tiny faint" style="margin-top:8px">' +
          PACK_VOICES.filter(function (v) { return v.id === curPack; }).map(function (v) { return v.desc; })[0] +
          "。切换后首次点词会下载对应音频（约 1 秒），之后秒出。" +
        "</div>" +
        '<div class="row" style="margin-top:10px"><button class="btn" id="test-voice">试听一句</button></div>';
    }
    if (!voices.length) {
      return '<div class="tiny faint">正在加载语音… 如果一直空着，说明这个浏览器没有可用语音。</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn" id="test-voice">试听一句</button></div>';
    }
    var accent = state.settings.accent || "en-US";
    var natural = voices.filter(function (v) { return tts.isNatural(v); });
    function inAccent(v) {
      return accent === "any" || String(v.lang || "").toLowerCase().indexOf(accent.toLowerCase()) === 0;
    }
    var primary = natural.filter(inAccent);
    var primaryLocal = voices.filter(function (v) { return !tts.isNatural(v) && inAccent(v); });
    var rest = voices.filter(function (v) { return !inAccent(v); });

    function opts(list) {
      return list.map(function (v) {
        var label = String(v.name).replace(/^Microsoft\s+/, "").replace(/\s*Online \(Natural\)\s*/i, " · 自然");
        return '<option value="' + esc(v.voiceURI) + '"' +
          (state.settings.voiceURI === v.voiceURI ? " selected" : "") + ">" +
          esc(label) + " · " + esc(v.lang) + "</option>";
      }).join("");
    }

    var html = '<div class="row" id="accent-row" style="margin-bottom:10px">' +
      ACCENTS.map(function (a) {
        return '<button class="btn' + (accent === a.id ? " primary" : "") +
          '" data-accent="' + a.id + '">' + a.label + "</button>";
      }).join("") + "</div>";

    html += '<div class="tiny" style="margin-bottom:8px">' +
      "当前口音下可用 <b>" + (primary.length + primaryLocal.length) + "</b> 个语音，其中 <b>" +
      primary.length + "</b> 个自然语音（推荐）。</div>";

    html += '<select id="voice-select"><option value="">自动（优先' +
      (accent === "any" ? "自然语音" : "本口音的自然语音") + "）</option>" +
      (primary.length ? '<optgroup label="' + (accent === "any" ? "自然语音" : "推荐 · 自然语音") + '">' + opts(primary) + "</optgroup>" : "") +
      (primaryLocal.length ? '<optgroup label="本地语音（机械音）">' + opts(primaryLocal) + "</optgroup>" : "") +
      (accent === "any" && rest.length ? '<optgroup label="其他口音">' + opts(rest) + "</optgroup>" : "") +
      "</select>";

    if (!primary.length) {
      html += '<div class="tiny" style="margin-top:8px;color:var(--warn)">' +
        "这个口音下没有在线自然语音。换 Microsoft Edge 打开本页，通常能拿到美音 Aria / Jenny / Guy / Davis / Emma。" +
        "</div>";
    } else {
      html += '<div class="tiny faint" style="margin-top:8px">在线自然语音需要联网；加载失败会自动退回本地语音。</div>';
    }

    html += '<div class="row" style="margin-top:10px">' +
      '<button class="btn" id="test-voice">试听一句</button>' +
      '<button class="btn ghost" id="test-voice-2">自然 vs 机械 对比</button></div>';
    return html;
  }

  function aiSectionHtml() {
    var pid = AI.providerId();
    var prov = AI_PROVIDERS[pid];
    var key = state.settings.aiKey || "";
    var masked = key ? (key.slice(0, 6) + "…" + key.slice(-4)) : "";

    return '<div class="tiny" style="margin-bottom:8px">让 AI 逐句批改你的英文，并给更自然的说法。Key 只保存在这台设备，直接调 API，不经过任何服务器。</div>' +
      '<div class="row" id="ai-provider-row" style="margin-bottom:10px">' +
        Object.keys(AI_PROVIDERS).map(function (k) {
          return '<button class="btn' + (pid === k ? " primary" : "") +
            '" data-ai-provider="' + k + '">' + AI_PROVIDERS[k].label + "</button>";
        }).join("") +
      "</div>" +
      '<input id="ai-key" type="password" autocomplete="off" placeholder="' +
        (masked ? "已保存：" + masked + "（重新输入可替换）" : "粘贴 API Key") + '" value="">' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn primary" id="ai-save">保存 Key</button>' +
        '<button class="btn" id="ai-test">测试连接</button>' +
        (key ? '<button class="btn ghost" id="ai-clear">清除</button>' : "") +
      "</div>" +
      '<div class="tiny faint" style="margin-top:8px">' + esc(prov.hint) +
        ' 当前模型：<b>' + esc(prov.model) + "</b></div>" +
      '<div class="tiny" id="ai-status" style="margin-top:6px"></div>';
  }

  function renderSettings() {
    var voices = tts.ready ? tts.voices : [];
    var html = '<div class="card"><h1>设置</h1>' +
      '<h3 style="margin-top:16px">主题</h3>' +
      '<div class="row" id="theme-row">' +
        THEMES.map(function (t) {
          return '<button class="btn' + ((state.settings.theme || "system") === t.id ? " primary" : "") +
            '" data-theme-btn="' + t.id + '">' + t.label + "</button>";
        }).join("") +
      "</div>" +

      '<h3 style="margin-top:22px">字号</h3>' +
      '<div class="row" id="fs-row">' +
        FONT_SCALES.map(function (f) {
          return '<button class="btn' + ((state.settings.fontScale || "normal") === f.id ? " primary" : "") +
            '" data-fs-btn="' + f.id + '">' + f.label + "</button>";
        }).join("") +
      "</div>" +
      '<div class="tiny faint" style="margin-top:8px">只影响界面文字大小，不改学习内容。觉得字小就切「大」或「特大」。</div>' +

      '<h3 style="margin-top:22px">语速</h3>' +
      '<div class="row" id="rate-row">' +
        [0.6, 0.7, 0.8, 0.9, 1.0].map(function (r) {
          return '<button class="btn' + (Math.abs((state.settings.rate || 1.0) - r) < 0.001 ? " primary" : "") +
            '" data-rate="' + r + '">' + r + "×</button>";
        }).join("") +
      "</div>" +
      '<div class="tiny faint" style="margin-top:8px">默认 1.0× 正常语速。听不清再降到 0.8× 或 0.6×，不要看中文字幕硬猜。</div>' +

      '<h3 style="margin-top:22px">发音</h3>' +
      voiceSectionHtml(voices) +

      '<h3 style="margin-top:22px">AI 批改</h3>' +
      aiSectionHtml() +

      '<h3 style="margin-top:22px">每日目标</h3>' +
      '<div class="row" id="target-row">' +
        [30, 60, 75, 90].map(function (m) {
          return '<button class="btn' + (state.settings.minutesTarget === m ? " primary" : "") +
            '" data-target="' + m + '">' + m + " 分钟</button>";
        }).join("") +
      "</div>" +
      '<div class="tiny faint" style="margin-top:8px">时间紧张选 30 分钟：跟读 12 + 句型 10 + 单词 5 + 输出 3。</div>' +

      '<h3 style="margin-top:22px">危险操作</h3>' +
      '<div class="row"><button class="btn bad" id="reset">清空所有进度</button></div>' +
      '<div class="tiny faint" style="margin-top:8px">清空前建议先在「进度」页导出一份备份。</div>' +

      '<div class="row" style="margin-top:24px;padding-top:14px;border-top:1px solid var(--line)">' +
        '<span class="tiny faint">EasyStudy 留学英语助手</span>' +
        '<div class="spacer"></div>' +
        '<span class="tiny" style="font-weight:600;color:var(--brand)">' + APP_VERSION + '</span>' +
      "</div>" +
      "</div>";

    html += '<div class="card"><h3>这套方案怎么用</h3><div class="small muted">' +
      "每天固定 60–90 分钟，顺序：跟读 → 句型 → 单词 → 输出。一周 5 天也比一天 5 小时强。" +
      "第 1–4 周只练生存场景（机场、海关、酒店、餐厅、交通、购物），不要碰美剧和单词书。" +
      "周末用「进度」页看一眼连续天数，断了不用自责，第二天接上就行。</div></div>";

    $("#view-settings").innerHTML = html;

    $$("[data-theme-btn]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.theme = b.dataset.themeBtn;
        save();
        applyTheme();
        renderSettings();
      });
    });
    $$("[data-fs-btn]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.fontScale = b.dataset.fsBtn;
        save();
        applyFontScale();
        renderSettings();
        toast("字号已切换");
      });
    });
    $$("[data-accent]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.accent = b.dataset.accent;
        state.settings.voiceURI = "";
        save();
        renderSettings();
        toast("口音已切换");
      });
    });
    // AI 批改设置
    $$("[data-ai-provider]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.aiProvider = b.dataset.aiProvider;
        save();
        renderSettings();
      });
    });
    var aiKeyEl = $("#ai-key");
    var aiSave = $("#ai-save");
    function setAiStatus(msg, bad) {
      var el = $("#ai-status");
      if (!el) return;
      el.textContent = msg || "";
      el.style.color = bad ? "var(--bad)" : "var(--ok)";
    }
    if (aiSave) aiSave.addEventListener("click", function () {
      var v = String(aiKeyEl.value || "").trim();
      if (!v) { toast("请先粘贴 Key"); return; }
      state.settings.aiKey = v;
      state.settings.aiModel = "";
      save();
      toast("AI Key 已保存（只存在本机）");
      renderSettings();
    });
    var aiClear = $("#ai-clear");
    if (aiClear) aiClear.addEventListener("click", function () {
      state.settings.aiKey = "";
      save();
      toast("已清除 AI Key");
      renderSettings();
    });
    var aiTest = $("#ai-test");
    if (aiTest) aiTest.addEventListener("click", function () {
      var v = String(aiKeyEl.value || "").trim();
      if (v) {
        state.settings.aiKey = v;
        state.settings.aiModel = "";   // 不再需要模型名
        save();
      }
      if (!AI.configured()) { setAiStatus("还没有 Key", true); return; }

      var prov = AI.provider();
      aiTest.disabled = true;
      setAiStatus("正在测试 " + prov.label + " …");

      AI._once(prov.model, "只回复两个字：可以").then(function (res) {
        setAiStatus("连接成功！模型 " + res.model + "，回复：" + String(res.text).slice(0, 30));
      }).catch(function (e) {
        var msg = String((e && e.detail) || (e && e.message) || e);
        var code = e && e.code;
        var tip = "";
        if (code === 401) tip = " → Key 不对";
        else if (code === 403) tip = " → 没权限，去方舟控制台开通这个模型";
        else if (code === 404) tip = " → 模型 " + prov.model + " 不存在或未开通";
        else if (code === 429) tip = " → 请求太频繁";
        setAiStatus("失败：" + msg.slice(0, 110) + tip, true);
      }).then(function () { aiTest.disabled = false; });
    });

    $$("[data-pack-voice]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.packVoice;
        state.settings.packVoice = id;
        save();
        renderSettings();
        audioPack.setVoice(id, true).then(function (ok) {
          if (!ok) { toast("这个音色包还没上传好"); return; }
          toast("已切换音色");
          tts.speak("Good morning. May I see your passport, please?");
        });
      });
    });
    $$("[data-rate]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.rate = Number(b.dataset.rate); save();
        toast("语速 " + b.dataset.rate + "×");
        renderSettings();
      });
    });
    $$("[data-target]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings.minutesTarget = Number(b.dataset.target); save(); renderSettings();
      });
    });
    var sel = $("#voice-select");
    if (sel) sel.addEventListener("change", function () {
      if (window.pywebview && window.pywebview.api) state.settings.edgeVoice = sel.value;
      else state.settings.voiceURI = sel.value;
      save();
      tts.speak("Hello, this is your English coach.");
    });
    var tv = $("#test-voice");
    if (tv) tv.addEventListener("click", function () {
      tts.speak("Good morning. May I see your passport, please?");
    });
    var tv2 = $("#test-voice-2");
    if (tv2) tv2.addEventListener("click", function () {
      var all = tts.voices;
      var nat = all.filter(function (v) { return tts.isNatural(v); })
        .sort(function (a, b) { return tts.score(b) - tts.score(a); })[0];
      var loc = all.filter(function (v) { return !tts.isNatural(v); })
        .sort(function (a, b) { return tts.score(b) - tts.score(a); })[0];
      if (!nat || !loc) { toast("需要同时有自然语音和本地语音才能对比"); return; }
      var sentence = "Good morning. May I see your passport, please?";
      var rate = state.settings.rate || 1.0;
      window.speechSynthesis.cancel();
      var u1 = new SpeechSynthesisUtterance(sentence);
      u1.voice = nat; u1.lang = nat.lang; u1.rate = rate;
      u1.onend = function () {
        setTimeout(function () {
          var u2 = new SpeechSynthesisUtterance(sentence);
          u2.voice = loc; u2.lang = loc.lang; u2.rate = rate;
          window.speechSynthesis.speak(u2);
        }, 600);
      };
      toast("先播自然语音，再播机械语音");
      window.speechSynthesis.speak(u1);
    });
    var rs = $("#reset");
    if (rs) rs.addEventListener("click", function () {
      if (!confirm("确定清空所有进度？这个操作不能撤销。")) return;
      state = defaultState(); save();
      toast("已清空");
      go("today");
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!DATA || !DATA.scenarios || !DATA.scenarios.length) {
      document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#eee">内容库加载失败：js/data.js 没有正确加载。</div>';
      return;
    }
    tts.init();
    audioPack.init();
    initTooltip();
    initSwipe();
    applyFontScale();
    applyTheme();
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: light)");
      var onScheme = function () {
        if ((state.settings.theme || "system") === "system") applyTheme();
      };
      if (mq.addEventListener) mq.addEventListener("change", onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
    $$(".tab").forEach(function (b) {
      b.addEventListener("click", function () { go(b.dataset.view, true); });
    });
    document.addEventListener("tts-ready", function () {
      if (!$("#view-settings").classList.contains("hidden")) renderSettings();
    });
    go("today");

    // 调试/截图用：index.html#stage=shadow|patterns|words|output 或 #view=words|grammar|exam
    var m = /^#stage=(\w+)$/.exec(location.hash || "");
    if (m) openStage(m[1]);
    var v = /^#view=(\w+)$/.exec(location.hash || "");
    if (v && VIEWS.indexOf(v[1]) >= 0) go(v[1]);

    // 首屏渲染完成后再打标记：之后切页重绘不再播放入场动画
    requestAnimationFrame(function () {
      document.body.classList.add("ready");
    });

    // 桌面版：从程序目录的 state.json 恢复进度
    // pywebview 的 api 是异步注入的，这里只判断桥是否存在，等待在 load() 内部完成
    if (window.DesktopStore) {
      window.DesktopStore.load().then(function (saved) {
        if (!saved || typeof saved !== "object") return;
        state = saved;
        applyFontScale();
        applyTheme();
        go(currentView() || "today");
      }).catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

