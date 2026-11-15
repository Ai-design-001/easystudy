/* 桌面能力桥：在 pywebview 里运行时，用 Python 的 edge-tts 发音、用文件保存进度
   在普通浏览器里打开时，全部自动退回浏览器自带能力，不影响 Web 版。
*/
(function () {
  "use strict";

  var apiReady = null;

  function waitApi() {
    if (apiReady) return apiReady;
    apiReady = new Promise(function (resolve) {
      if (window.pywebview && window.pywebview.api) { resolve(window.pywebview.api); return; }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve((window.pywebview && window.pywebview.api) || null);
      }
      window.addEventListener("pywebviewready", finish, { once: true });
      setTimeout(finish, 1500);
    });
    return apiReady;
  }

  var current = null;
  var seq = 0;          // 每次朗读的序号，用于丢弃过期的合成结果
  var pendingText = ""; // 正在合成的文本

  var DesktopSpeech = {
    available: function () {
      return !!(window.pywebview && window.pywebview.api && window.pywebview.api.speak);
    },
    supported: true,
    /* speak(text, {rate, onstart, onend, onerror}) */
    speak: function (text, opts) {
      opts = opts || {};
      var mySeq = ++seq;
      pendingText = text;
      stopCurrent();
      waitApi().then(function (api) {
        if (!api || !api.speak) { if (mySeq === seq) fallback(text, opts); return; }
        var rate = opts.rate || 0.8;
        var voice = opts.voice || "en-US-AriaNeural";
        api.speak(text, rate, voice).then(function (res) {
          if (mySeq !== seq) return;              // 已经点了别的句子，丢掉旧结果
          if (!res || !res.ok || !res.audio) { fallback(text, opts); return; }
          var audio = new Audio("data:audio/mpeg;base64," + res.audio);
          current = audio;
          audio.onplay = function () { if (opts.onstart) opts.onstart(); };
          audio.onended = function () { if (opts.onend) opts.onend(); };
          audio.onerror = function () { fallback(text, opts); };
          var p = audio.play();
          if (p && p.catch) p.catch(function () { if (mySeq === seq) fallback(text, opts); });
        }).catch(function () { if (mySeq === seq) fallback(text, opts); });
      });
    },
    stop: function () {
      seq++;
      pendingText = "";
      stopCurrent();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  };

  function stopCurrent() {
    if (current) {
      try { current.pause(); current.currentTime = 0; } catch (e) {}
      current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function fallback(text, opts) {
    if (!("speechSynthesis" in window)) {
      if (opts.onerror) opts.onerror(new Error("没有可用的语音"));
      return;
    }
    var u = new SpeechSynthesisUtterance(text);
    var voices = window.speechSynthesis.getVoices() || [];
    var en = voices.filter(function (v) { return /^en(-|_)?US/i.test(v.lang); });
    if (en[0]) u.voice = en[0];
    u.lang = (en[0] && en[0].lang) || "en-US";
    u.rate = opts.rate || 0.8;
    if (opts.onstart) u.onstart = opts.onstart;
    if (opts.onend) u.onend = opts.onend;
    if (opts.onerror) u.onerror = opts.onerror;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  var DesktopStore = {
    available: function () {
      return !!(window.pywebview && window.pywebview.api && window.pywebview.api.save_state);
    },
    save: function (obj) {
      waitApi().then(function (api) {
        if (!api || !api.save_state) return;
        try { api.save_state(JSON.stringify(obj)); } catch (e) {}
      });
    },
    load: function () {
      return waitApi().then(function (api) {
        if (!api || !api.load_state) return null;
        return api.load_state().then(function (res) {
          if (!res || !res.ok || !res.data) return null;
          try { return JSON.parse(res.data); } catch (e) { return null; }
        }).catch(function () { return null; });
      });
    }
  };

  var DesktopFile = {
    available: function () {
      return !!(window.pywebview && window.pywebview.api && window.pywebview.api.save_text_file);
    },
    /* 弹原生另存为对话框；非桌面环境返回 null，由调用方退回 Blob 下载 */
    saveText: function (filename, content) {
      if (!(window.pywebview && window.pywebview.api && window.pywebview.api.save_text_file)) {
        return Promise.resolve(null);
      }
      return waitApi().then(function (api) {
        return api.save_text_file(filename, content);
      }).catch(function (e) { return { ok: false, error: String(e) }; });
    }
  };

  window.DesktopSpeech = DesktopSpeech;
  window.DesktopStore = DesktopStore;
  window.DesktopFile = DesktopFile;
  window.IS_DESKTOP = !!(window.pywebview && window.pywebview.api);
})();
