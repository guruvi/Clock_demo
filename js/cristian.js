// cristian.js — Cristian's Algorithm: exchange + animated diagram

const Cristian = (() => {
  function nowEpoch() {
    return state.originEpoch + performance.now();
  }

  // Called by host when "Run Sync" is pressed
  function runSync() {
    const t1 = nowEpoch();
    state.cristian.t1 = t1;
    PeerManager.send({ type: 'CRISTIAN_PING', t1 });
    _showAnimPhase('ping');
    updateFormula({ t1, T: '?', t2: '?', rtt: '?', offset: '?' });
  }

  // Called on receiver side when CRISTIAN_PING arrives
  function handlePing(msg) {
    const T = nowEpoch();
    PeerManager.send({ type: 'CRISTIAN_PONG', t1: msg.t1, T });
    _showAnimPhase('pong');
  }

  // Called on sender side when CRISTIAN_PONG arrives
  function handlePong(msg) {
    const t2 = nowEpoch();
    const t1 = state.cristian.t1;
    const T = msg.T;
    const rtt = t2 - t1;
    const offset = T + rtt / 2 - t2;

    state.cristian = { t1, T, t2, rtt, offset };
    _showAnimPhase('done');
    updateFormula({ t1, T, t2, rtt: rtt.toFixed(1), offset: offset.toFixed(1) });

    const btn = document.getElementById('btn-play-synced');
    if (btn) btn.disabled = !(state.video.ready && state.video.peerReady);

    const resultEl = document.getElementById('cristian-sync-result');
    if (resultEl) {
      resultEl.textContent = `Sync complete — RTT: ${rtt.toFixed(1)}ms, Estimated offset: ${offset.toFixed(1)}ms`;
      resultEl.style.display = 'block';
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
