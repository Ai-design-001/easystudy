/* 录音：跟读用。需要浏览器允许麦克风。
   file:// 下 Chrome/Edge 通常可以作为安全上下文使用；若被拒绝会给出明确提示。
*/
window.Recorder = (function () {
  "use strict";

  var mediaRecorder = null;
  var chunks = [];
  var stream = null;
  var startedAt = 0;
  var lastUrl = null;

  function isIOS() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ 伪装成 Mac
    return /Macintosh/.test(ua) && "ontouchend" in document;
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      || window.navigator.standalone === true;
  }

  function supported() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    // 老版 iOS 没有 MediaRecorder，只有 getUserMedia
    return !!window.MediaRecorder;
  }

  /* 只有浏览器根本不支持录音时才隐藏按钮。
     iOS 14.5+ 的 Safari 是支持录音的，主屏模式在较新系统上也支持，
     所以不再对所有 iOS 直接隐藏，让用户试，失败时给具体原因。 */
  function blockedByPlatform() {
    return !supported();
  }

  function cleanupStream() {
    if (stream) {
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      stream = null;
    }
  }

  function start() {
    if (!supported()) {
      var hint = isIOS()
        ? "iOS 不支持网页录音（Safari 限制），可以跳过录音直接跟读"
        : "这个浏览器不支持录音（缺少 MediaRecorder）";
      return Promise.reject(new Error(hint));
    }
    if (mediaRecorder && mediaRecorder.state === "recording") {
      return Promise.resolve();
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      chunks = [];
      var type = "";
      if (window.MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported("audio/webm")) type = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) type = "audio/mp4";
      }
      mediaRecorder = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
      mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
      startedAt = Date.now();
      return true;
    }).catch(function (err) {
      cleanupStream();
      var name = err && err.name;
      var msg;
      if (name === "NotAllowedError" || name === "SecurityError") {
        if (isIOS() && isStandalone()) {
          msg = "iPhone 主屏模式被系统拒绝了麦克风。两种办法：\n" +
            "1) 用 Safari 打开这个网址（不是主屏图标），首次会弹权限，点允许；\n" +
            "2) 或者跳过录音直接跟读。";
        } else if (isIOS()) {
          msg = "麦克风被拒绝。请到 设置 → Safari 浏览器 → 麦克风 里允许访问，然后刷新页面。";
        } else {
          msg = "麦克风权限被拒绝：点地址栏左侧的图标允许麦克风，然后刷新。";
        }
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "没有检测到麦克风设备。";
      } else if (name === "NotReadableError") {
        msg = "麦克风被其它程序占用（比如正在通话或录音），关掉后重试。";
      } else {
        msg = "录音启动失败：" + (err && err.message ? err.message : err);
      }
      var e2 = new Error(msg);
      e2.name = name;
      throw e2;
    });
  }

  function stop() {
    return new Promise(function (resolve, reject) {
      if (!mediaRecorder || mediaRecorder.state !== "recording") {
        cleanupStream();
        return reject(new Error("当前没有在录音"));
      }
      var seconds = Math.round((Date.now() - startedAt) / 100) / 10;
      mediaRecorder.onstop = function () {
        var blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) {} }
        lastUrl = URL.createObjectURL(blob);
        cleanupStream();
        mediaRecorder = null;
        resolve({ url: lastUrl, seconds: seconds, size: blob.size });
      };
      try {
        mediaRecorder.stop();
      } catch (e) {
        cleanupStream();
        reject(e);
      }
    });
  }

  function isRecording() {
    return !!(mediaRecorder && mediaRecorder.state === "recording");
  }

  function play(url) {
    var audio = new Audio(url);
    return audio.play();
  }

  return {
    supported: supported,
    blockedByPlatform: blockedByPlatform,
    isIOS: isIOS,
    start: start,
    stop: stop,
    isRecording: isRecording,
    play: play
  };
})();
