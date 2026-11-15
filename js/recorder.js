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
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  /* 该环境下录音是否可能被系统阻止（iOS 主屏 PWA 已知限制） */
  function blockedByPlatform() {
    return isIOS();
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
    if (isIOS() && isStandalone()) {
      // iOS 加到主屏后 getUserMedia 常被系统拒绝，提前给出可读提示
      return Promise.reject(new Error("iPhone 主屏模式下无法录音，用 Safari 打开网页版可以录音"));
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
      var msg = err && err.name === "NotAllowedError"
        ? (isIOS()
          ? "麦克风被系统拒绝：iPhone 请在「设置 → Safari → 麦克风」允许访问"
          : "麦克风权限被拒绝：请在地址栏左侧的图标里允许麦克风，然后刷新")
        : (err && err.name === "NotFoundError"
          ? "没有检测到麦克风设备"
          : ("录音启动失败：" + (err && err.message ? err.message : err)));
      throw new Error(msg);
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
