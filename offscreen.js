// offscreen.js — Gizli YouTube oynatıcı (Şu An Çalıyor widget'ı için).
// YouTube embed iframe'ini postMessage (IFrame API protokolü) ile yönetir — uzak script yüklemeden.
// Tarayıcıda HİÇBİR pencere/sekme görünmez. Gömülemeyen videolarda SW pencere yedeğine düşer.
'use strict';

let iframe = null, curId = '', wantUnmute = false;
const state = { videoId: '', title: '', author: '', position: 0, duration: 0, playing: false, volume: 100, muted: true, ended: false };

function post(obj) { try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify(obj), '*'); } catch (_) {} }
function cmd(func, args) { post({ event: 'command', func: func, args: args || [], id: 1, channel: 'widget' }); }
function handshake() { post({ event: 'listening', id: 1, channel: 'widget' }); }

function load(videoId) {
  if (!videoId || (videoId === curId && iframe)) return; // aynı video (race/çift mesaj) → yok say
  curId = videoId; state.videoId = videoId; state.ended = false; state.muted = true; state.playing = false; wantUnmute = true;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:320px;height:180px;border:0;';
    iframe.src = 'https://www.youtube.com/embed/' + videoId + '?enablejsapi=1&autoplay=1&mute=1&playsinline=1&origin=' + encodeURIComponent(location.origin);
    iframe.addEventListener('load', () => { console.log('[Tracked off] iframe yüklendi'); handshake(); setTimeout(() => { handshake(); cmd('playVideo'); }, 300); });
    document.body.appendChild(iframe);
    console.log('[Tracked off] embed yükleniyor:', videoId);
  } else {
    cmd('loadVideoById', [videoId]);
    cmd('mute'); cmd('playVideo');
  }
}

window.addEventListener('message', (e) => {
  if (!iframe || e.source !== iframe.contentWindow) return;
  let d; try { d = (typeof e.data === 'string') ? JSON.parse(e.data) : e.data; } catch (_) { return; }
  if (!d || !d.event) return;
  if (d.event && d.event !== 'infoDelivery') console.log('[Tracked off]', d.event, d.info != null ? d.info : '');
  if (d.event === 'onReady' || d.event === 'initialDelivery') { handshake(); cmd('playVideo'); }
  else if (d.event === 'onError') { try { chrome.runtime.sendMessage({ off: 'error', code: d.info, videoId: curId }); } catch (_) {} }
  else if (d.event === 'onStateChange') {
    const st = d.info;
    state.playing = (st === 1); state.ended = (st === 0);
    if (st === 1 && wantUnmute) { wantUnmute = false; cmd('unMute'); cmd('setVolume', [state.volume || 100]); }
  }
  else if (d.event === 'infoDelivery' && d.info) {
    const inf = d.info;
    if (inf.currentTime != null) state.position = inf.currentTime;
    if (inf.duration != null) state.duration = inf.duration;
    if (inf.volume != null) state.volume = Math.round(inf.volume);
    if (inf.muted != null) state.muted = !!inf.muted;
    if (typeof inf.playerState === 'number') { state.playing = (inf.playerState === 1); state.ended = (inf.playerState === 0); }
    if (inf.videoData) {
      if (inf.videoData.title) state.title = inf.videoData.title;
      if (inf.videoData.author) state.author = inf.videoData.author;
      if (inf.videoData.video_id) state.videoId = inf.videoData.video_id;
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg || msg.off == null) return;
  try {
    if (msg.off === 'play') { load(String(msg.videoId || '')); send({ ok: true }); }
    else if (msg.off === 'state') { send({ ok: true, state: state }); }
    else if (msg.off === 'cmd') {
      const c = msg.cmd;
      if (c === 'play') cmd('playVideo');
      else if (c === 'pause') cmd('pauseVideo');
      else if (c === 'seek') cmd('seekTo', [Number(msg.value) || 0, true]);
      else if (c === 'volume') { state.volume = Number(msg.value) || 0; if (state.muted) cmd('unMute'); cmd('setVolume', [state.volume]); }
      else if (c === 'mute') { if (state.muted) cmd('unMute'); else cmd('mute'); }
      send({ ok: true });
    }
    else if (msg.off === 'stop') { if (iframe) { try { iframe.remove(); } catch (_) {} iframe = null; } curId = ''; state.playing = false; send({ ok: true }); }
    else send({ ok: false });
  } catch (_) { try { send({ ok: false }); } catch (e2) {} }
  return true;
});
