// main.js — App bootstrap, state machine, message routing, event wiring

// ─── Global State ────────────────────────────────────────────────────────────
const state = {
  originEpoch: Date.now() - performance.now(),
  myPeerId: null,
  role: null,     // 'host' | 'guest'
  conn: null,
  step: 0,        // 0=connect, 1=manual, 2=cristian, 3=ntp, 4=summary
  peer: {
    id: null,
    lastClockEpoch: 0,
  },
  cristian: {
    t1: 0, T: 0, t2: 0, rtt: 0, offset: 0,
  },
  results: {
    manual: null,
    cristian: null,
    ntp: null,
  },
  video: {
    ready: false,
    peerReady: false,
    myStartEpoch: null,
    peerStartEpoch: null,
  },
};

// ─── Message Router ──────────────────────────────────────────────────────────
function onMessage(msg) {
  switch (msg.type) {
    case 'HELLO':
      state.peer.id = msg.peerId;
      break;

    case 'CLOCK_TICK': {
      const oneWay = (Date.now() - msg.sendTime) / 2;
      state.peer.lastClockEpoch = msg.epochMs + oneWay;
      break;
    }

    case 'READY_CHECK':
      state.video.peerReady = true;
      VideoManager.onPeerReady();
      PeerManager.send({ type: 'READY_ACK', videoSrc: msg.videoSrc });
      break;

    case 'READY_ACK':
      state.video.peerReady = true;
      VideoManager.onPeerReady();
      break;

    case 'CRISTIAN_PING':
      Cristian.handlePing(msg);
      break;

    case 'CRISTIAN_PONG':
      Cristian.handlePong(msg);
      break;

    case 'NTP_PLAY_AT':
      if (state.step === 2) {
        VideoManager.schedulePlay(msg.epochMs);
      } else if (state.step === 3) {
        NTPSync.handlePlayAt(msg);
      }
      break;

    case 'PLAY_START':
      state.video.peerStartEpoch = msg.epochMs;
      _checkOffsetResult();
      break;

    case 'STEP_ADVANCE':
      if (state.role === 'guest') {
        goToStep(msg.step);
      }
      break;
  }
}

function _checkOffsetResult() {
  const offset = VideoManager.computeOffset();
  if (offset == null) return;

  const stepName = state.step === 1 ? 'manual' : state.step === 2 ? 'cristian' : 'ntp';
  state.results[stepName] = offset;

  const el = document.getElementById(`result-${stepName}`);
  if (el) {
    el.textContent = `Measured offset: ${Math.round(offset)}ms`;
    el.style.display = 'block';
    el.classList.add('result-flash');
    setTimeout(() => el.classList.remove('result-flash'), 1000);
  }
}

// ─── Connection Events ────────────────────────────────────────────────────────
function onConnected(evt) {
  if (evt.type === 'peer_ready') {
    _showPeerPanel(evt.peerId);
    return;
  }

  document.getElementById('status-dot').classList.add('connected');
  document.getElementById('status-text').textContent = 'Connected';
  document.getElementById('status-peer-id').textContent = state.peer.id ? `↔ ${state.peer.id.slice(0, 8)}` : '';

  // Re-announce video readiness in case canplaythrough fired before connection
  const video = document.getElementById('demo-video');
  if (state.video.ready && video) {
    PeerManager.send({ type: 'READY_CHECK', videoSrc: video.src });
  }

  if (state.role === 'host') {
    goToStep(1);
  }
}

function onDisconnected() {
  document.getElementById('status-dot').classList.remove('connected');
  document.getElementById('status-text').textContent = 'Disconnected';
  showToast('Peer disconnected');
}

// ─── Step Navigation ──────────────────────────────────────────────────────────
function goToStep(n) {
  state.step = n;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${n}`);
  if (panel) panel.classList.add('active');

  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) prevBtn.disabled = n <= 1;
  if (nextBtn) nextBtn.disabled = n >= 4;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.step) === n);
  });

  document.querySelectorAll('#step-dots .dot').forEach(dot => {
    dot.classList.toggle('active', parseInt(dot.dataset.step) === n);
  });

  if (state.role === 'host') {
    PeerManager.send({ type: 'STEP_ADVANCE', step: n });
  }

  if (n === 4) SummaryChart.update();
}

// ─── Connection Panel ─────────────────────────────────────────────────────────
function _showPeerPanel(peerId) {
  const idEl = document.getElementById('my-peer-id');
  if (idEl) idEl.textContent = peerId;

  const qrContainer = document.getElementById('qr-container');
  if (qrContainer && peerId) {
    qrContainer.innerHTML = '';
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?peer=${peerId}`;
    new QRCode(qrContainer, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  const params = new URLSearchParams(window.location.search);
  const autoPeer = params.get('peer');
  if (autoPeer && autoPeer !== peerId) {
    const input = document.getElementById('connect-input');
    if (input) input.value = autoPeer;
    setTimeout(() => PeerManager.connect(autoPeer), 300);
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── Hamburger Menu ───────────────────────────────────────────────────────────
function toggleMenu() {
  const menu = document.getElementById('hamburger-menu');
  if (menu) menu.classList.toggle('open');
}

// ─── DOM Ready ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  VideoManager.init();
  ClockDisplay.start();
  PeerManager.init(onMessage, onConnected, onDisconnected);

  goToStep(0);

  document.getElementById('btn-connect').addEventListener('click', () => {
    const val = document.getElementById('connect-input').value.trim();
    if (val) PeerManager.connect(val);
  });

  document.getElementById('connect-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-connect').click();
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (state.step > 1) goToStep(state.step - 1);
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (state.step < 4) goToStep(state.step + 1);
  });

  document.getElementById('hamburger-btn').addEventListener('click', toggleMenu);

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step);
      if (state.role === 'host') goToStep(step);
      toggleMenu();
    });
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('hamburger-menu');
    const btn = document.getElementById('hamburger-btn');
    if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove('open');
    }
  });

  // On first interaction: unlock autoplay and trigger media load on mobile
  document.body.addEventListener('click', () => {
    VideoManager.unlockAutoplay();
    VideoManager.triggerLoad();
  }, { once: true });

  document.getElementById('btn-play-manual').addEventListener('click', () => {
    VideoManager.unlockAutoplay();
    VideoManager.resetForStep();
    setTimeout(() => VideoManager.playNow(), 50);
  });

  document.getElementById('btn-run-sync').addEventListener('click', () => {
    if (state.role === 'host') Cristian.runSync();
  });

  document.getElementById('btn-play-synced').addEventListener('click', () => {
    VideoManager.unlockAutoplay();
    if (state.role === 'host') Cristian.playWithOffset();
  });

  document.getElementById('btn-play-ntp').addEventListener('click', () => {
    VideoManager.unlockAutoplay();
    if (state.role === 'host') NTPSync.schedulePlay();
  });

  document.getElementById('btn-run-all').addEventListener('click', () => {
    state.results = { manual: null, cristian: null, ntp: null };
    VideoManager.resetForStep();
    if (state.role === 'host') goToStep(1);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.step >= 2) {
      showToast('Warning: Tab is hidden — scheduled playback may be delayed!', 5000);
    }
  });
});
