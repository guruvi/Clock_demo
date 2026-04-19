// video.js — Video preload, readiness handshake, playback, measurement

const VideoManager = (() => {
  let _media = null;  // active media element (video or audio)
  let _autoplayed = false;

  function init() {
    const video = document.getElementById('demo-video');
    const audio = document.getElementById('demo-audio');

    // Try video first, fall back to audio
    _tryLoad(video, () => {
      // video failed to load, try audio
      if (video) video.style.display = 'none';
      _tryLoad(audio, () => {
        // both failed
        console.warn('No media file found (tried sync_demo.mp4 and sync_demo.mp3)');
      });
    });
  }

  function _tryLoad(el, onError) {
    if (!el) { onError(); return; }

    el.addEventListener('canplaythrough', () => {
      _media = el;
      if (el.tagName === 'VIDEO') el.style.display = 'block';
      else {
        // Show audio player UI
        el.style.display = 'block';
        el.controls = true;
      }
      state.video.ready = true;
      _updateReadyUI();
      PeerManager.send({ type: 'READY_CHECK', videoSrc: el.src });
    }, { once: true });

    el.addEventListener('error', () => onError(), { once: true });

    el.load();

    // Fallback: already buffered
    if (el.readyState >= 4) {
      _media = el;
      state.video.ready = true;
      _updateReadyUI();
    }
  }

  function onPeerReady() {
    state.video.peerReady = true;
    _updateReadyUI();
  }

  function _updateReadyUI() {
    const btn1 = document.getElementById('btn-play-manual');
    const btn2 = document.getElementById('btn-play-synced');
    const btn3 = document.getElementById('btn-play-ntp');

    const bothReady = state.video.ready && state.video.peerReady;

    if (btn1) btn1.disabled = !bothReady;
    if (btn2) btn2.disabled = !bothReady;
    if (btn3) btn3.disabled = !bothReady;

    const badgeText = !state.video.ready ? 'Video loading...'
      : !state.video.peerReady ? 'Waiting for peer...'
      : 'Both ready ✓';
    const badgeClass = !state.video.ready ? 'loading'
      : !state.video.peerReady ? 'waiting'
      : 'ready';

    document.querySelectorAll('.video-ready-badge').forEach(badge => {
      badge.textContent = badgeText;
      badge.className = `ready-badge ${badgeClass} video-ready-badge`;
    });
  }

  function unlockAutoplay() {
    // Called from first button tap to unlock autoplay for future programmatic play()
    if (_autoplayed || !_media) return;
    _autoplayed = true;
    const p = _media.play();
    if (p && p.then) {
      p.then(() => { _media.pause(); _media.currentTime = 0; }).catch(() => {});
    }
  }

  function playNow() {
    if (!_media) return 0;
    _media.currentTime = 0;
    const epochMs = Date.now();
    _media.play().then(() => {
      state.video.myStartEpoch = Date.now();
      PeerManager.send({ type: 'PLAY_START', epochMs: state.video.myStartEpoch });
    }).catch(err => console.error('play() failed:', err));
    return epochMs;
  }

  function schedulePlay(epochMs) {
    if (!_media) return;
    _media.currentTime = 0;
    const delay = epochMs - Date.now();

    if (delay < 0) {
      console.warn('schedulePlay: delay is negative, playing immediately');
      playNow();
      return;
    }

    setTimeout(() => {
      _media.currentTime = 0;
      _media.play().then(() => {
        state.video.myStartEpoch = Date.now();
        PeerManager.send({ type: 'PLAY_START', epochMs: state.video.myStartEpoch });
      }).catch(err => console.error('schedulePlay play() failed:', err));
    }, delay);
  }

  function computeOffset() {
    const my = state.video.myStartEpoch;
    const peer = state.video.peerStartEpoch;
    if (my == null || peer == null) return null;
    return Math.abs(my - peer);
  }

  function resetForStep() {
    state.video.myStartEpoch = null;
    state.video.peerStartEpoch = null;
    if (_media) {
      _media.pause();
      _media.currentTime = 0;
    }
  }

  return { init, onPeerReady, unlockAutoplay, playNow, schedulePlay, computeOffset, resetForStep };
})();
