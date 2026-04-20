// cristian.js — Cristian's Algorithm: multiple pings, minimum RTT

const Cristian = (() => {
  const PING_COUNT = 5;       // number of pings to send
  const PING_INTERVAL = 50;   // ms between pings
  let _pings = [];             // { t1, T, t2, rtt, offset } per round
  let _pingsSent = 0;

  function nowEpoch() {
    return state.originEpoch + performance.now();
  }

  // Called by guest when "Run Sync" is pressed
  function runSync() {
    _pings = [];
    _pingsSent = 0;
    _showAnimPhase('ping');
    updateFormula({ t1: '?', T: '?', t2: '?', rtt: '?', offset: '?' });
    _sendPing();
  }

  function _sendPing() {
    if (_pingsSent >= PING_COUNT) return;
    _pingsSent++;
    const t1 = nowEpoch();
    state.cristian.t1 = t1;
    PeerManager.send({ type: 'CRISTIAN_PING', t1, seq: _pingsSent });
  }

  // Called on host side when CRISTIAN_PING arrives — just echo back with timestamp
  function handlePing(msg) {
    const T = nowEpoch();
    PeerManager.send({ type: 'CRISTIAN_PONG', t1: msg.t1, T, seq: msg.seq });
  }

  // Called on guest side when CRISTIAN_PONG arrives
  function handlePong(msg) {
    const t2 = nowEpoch();
    const rtt = t2 - msg.t1;
    const offset = msg.T + rtt / 2 - t2;

    _pings.push({ t1: msg.t1, T: msg.T, t2, rtt, offset });

    // Show progress on host only
    const resultEl = document.getElementById('cristian-sync-result');
    if (resultEl && state.role === 'host') {
      resultEl.textContent = `Ping ${_pings.length}/${PING_COUNT} — RTT: ${rtt.toFixed(1)}ms`;
      resultEl.style.display = 'block';
    }

    if (_pings.length < PING_COUNT) {
      // Send next ping after interval
      setTimeout(_sendPing, PING_INTERVAL);
      _showAnimPhase('ping');
    } else {
      // All pings done — pick the one with minimum RTT
      const best = _pings.reduce((a, b) => a.rtt < b.rtt ? a : b);
      state.cristian = best;

      _showAnimPhase('done');
      updateFormula({
        t1: best.t1,
        T: best.T,
        t2: best.t2,
        rtt: best.rtt.toFixed(1),
        offset: best.offset.toFixed(1),
      });

      const btn = document.getElementById('btn-play-synced');
      if (btn) btn.disabled = !(state.video.ready && state.video.peerReady);

      const allRtts = _pings.map(p => p.rtt.toFixed(1)).join(', ');
      if (resultEl && state.role === 'host') {
        resultEl.textContent = `Best RTT: ${best.rtt.toFixed(1)}ms (from ${PING_COUNT} pings: ${allRtts}ms) → Offset: ${best.offset.toFixed(1)}ms`;
        resultEl.style.display = 'block';
      }
    }
  }

  function updateFormula({ t1, T, t2, rtt, offset }) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = typeof val === 'number' ? val.toFixed(1) : val;
    };
    set('formula-t1', t1);
    set('formula-T', T);
    set('formula-t2', t2);
    set('formula-rtt', rtt);
    set('formula-offset', offset);
  }

  function _showAnimPhase(phase) {
    const diag = document.getElementById('cristian-diagram');
    if (!diag) return;
    diag.querySelectorAll('.anim-phase').forEach(el => {
      el.classList.remove('active', 'animate');
    });
    const el = diag.querySelector(`.phase-${phase}`);
    if (el) {
      el.classList.add('active');
      void el.offsetWidth;
      el.classList.add('animate');
    }
  }

  // Called when "Play Synced" pressed by host
  function playWithOffset() {
    VideoManager.resetForStep();
    const playAtEpoch = Date.now() + 1500;
    PeerManager.send({ type: 'NTP_PLAY_AT', epochMs: playAtEpoch });
    VideoManager.schedulePlay(playAtEpoch);
  }

  return { runSync, handlePing, handlePong, playWithOffset };
})();
