// clock.js — Live clock display and offset ticker

const ClockDisplay = (() => {
  let _interval = null;
  let _minOffset = null;

  const elMyClock = () => document.getElementById('my-clock');
  const elPeerClock = () => document.getElementById('peer-clock');
  const elOffset = () => document.getElementById('clock-offset');
  const elStatusOffset = () => document.getElementById('status-offset');

  function formatTime(epochMs) {
    const d = new Date(epochMs);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  function formatOffset(ms) {
    const sign = ms >= 0 ? '+' : '-';
    return `${sign}${Math.abs(Math.round(ms))}ms`;
  }

  function offsetClass(absMs) {
    if (absMs < 50) return 'offset-good';
    if (absMs < 200) return 'offset-warn';
    return 'offset-bad';
  }

  function start() {
    if (_interval) return;
    _interval = setInterval(_tick, 100);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  function _tick() {
    const now = Date.now();
    const myEl = elMyClock();
    const peerEl = elPeerClock();
    const offsetEl = elOffset();
    const statusEl = elStatusOffset();

    if (myEl) myEl.textContent = formatTime(now);

    const minOffsetEl = document.getElementById('clock-min-offset');

    if (state.peer.lastClockEpoch && peerEl) {
      peerEl.textContent = formatTime(state.peer.lastClockEpoch);
      const diff = now - state.peer.lastClockEpoch;
      const abs = Math.abs(diff);

      if (offsetEl) {
        offsetEl.textContent = formatOffset(diff);
        offsetEl.className = 'offset-value ' + offsetClass(abs);
      }
      if (statusEl) {
        statusEl.textContent = formatOffset(diff);
        statusEl.className = 'status-offset ' + offsetClass(abs);
      }

      // Track minimum absolute offset
      if (_minOffset === null || abs < _minOffset) {
        _minOffset = abs;
      }
      if (minOffsetEl) {
        minOffsetEl.textContent = `+${Math.round(_minOffset)}ms`;
        minOffsetEl.className = 'offset-value ' + offsetClass(_minOffset);
      }
    } else {
      if (peerEl) peerEl.textContent = '--:--:--.---';
      if (offsetEl) { offsetEl.textContent = '---'; offsetEl.className = 'offset-value'; }
      if (statusEl) { statusEl.textContent = '---'; statusEl.className = 'status-offset'; }
      if (minOffsetEl) { minOffsetEl.textContent = '—'; minOffsetEl.className = 'offset-value'; }
    }
  }

  return { start, stop, formatTime, formatOffset };
})();
