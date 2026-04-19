// video.js — Video preload, readiness handshake, playback, measurement

const VideoManager = (() => {
  let _video = null;
  let _autoplayed = false;

  function init() {
    _video = document.getElementById('demo-video');
    if (!_video) return;

    _video.addEventListener('loadedmetadata', () => {
      _video.load();
    });

    _video.addEventListener('canplaythrough', () => {
      state.video.ready = true;
      _updateReadyUI();
      PeerManager.send({ type: 'READY_CHECK', videoSrc: _video.src });
    });

    // Fallback: if canplaythrough fired before listener attached
    if (_video.readyState >= 4) {
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
    if (_autoplayed || !_video) return;
    _autoplayed = true;
    const p = _video.play();
    if (p && p.then) {
      p.then(() => { _video.pause(); _video.currentTime = 0; }).catch(() => {});
    }
  }

  function playNow() {
    if (!_video) return 0;
    _video.currentTime = 0;
    const epochMs = Date.now();
    _video.play().then(() => {
      state.video.myStartEpoch = Date.now();
      PeerManager.send({ type: 'PLAY_START', epochMs: state.video.myStartEpoch });
    }).catch(err => console.error('play() failed:', err));
    return epochMs;
  }

  function schedulePlay(epochMs) {
    if (!_video) return;
    _video.currentTime = 0;
    const delay = epochMs - Date.now();

    if (delay < 0) {
      console.warn('schedulePlay: delay is negative, playing immediately');
      playNow();
      return;
    }

    setTimeout(() => {
      _video.currentTime = 0;
      _video.play().then(() => {
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
    if (_video) {
      _video.pause();
      _video.currentTime = 0;
    }
  }

  return { init, onPeerReady, unlockAutoplay, playNow, schedulePlay, computeOffset, resetForStep };
})();
