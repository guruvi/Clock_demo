// peer.js — PeerJS wrapper: connect, send, receive, heartbeat

const PeerManager = (() => {
  let _peer = null;
  let _conn = null;
  let _heartbeatInterval = null;
  let _seq = 0;
  let _onMessage = null;
  let _onConnected = null;
  let _onDisconnected = null;
  let _reconnectTimer = null;
  let _reconnectDelay = 1000;

  function nowEpoch() {
    return state.originEpoch + performance.now();
  }

  function init(onMessage, onConnected, onDisconnected) {
    _onMessage = onMessage;
    _onConnected = onConnected;
    _onDisconnected = onDisconnected;

    _peer = new Peer(undefined, {
      debug: 3,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });

    _peer.on('open', (id) => {
      state.myPeerId = id;
      onConnected({ type: 'peer_ready', peerId: id });
    });

    _peer.on('connection', (conn) => {
      if (_conn) {
        conn.close();
        return;
      }
      _setupConnection(conn, 'host');
    });

    _peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'peer-unavailable') {
        showToast('Peer not found. Check the ID and try again.');
      } else if (err.type === 'network' || err.type === 'server-error') {
        showToast('Connection error: ' + err.type);
      }
    });

    _peer.on('disconnected', () => {
      _peer.reconnect();
    });
  }

  function connect(peerId) {
    if (_conn) return;
    const conn = _peer.connect(peerId, { reliable: true, serialization: 'json' });
    _setupConnection(conn, 'guest');
  }

  function _setupConnection(conn, role) {
    _conn = conn;
    state.conn = conn;
    state.role = role;

    conn.on('open', () => {
      _reconnectDelay = 1000;
      send({ type: 'HELLO', peerId: state.myPeerId, role });
      _startHeartbeat();
      _onConnected({ type: 'connected', role });
    });

    conn.on('data', (msg) => {
      if (_onMessage) _onMessage(msg);
    });

    conn.on('close', () => {
      _cleanup();
      _onDisconnected && _onDisconnected();
      _scheduleReconnect();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      _cleanup();
      _onDisconnected && _onDisconnected();
    });
  }

  function _cleanup() {
    _conn = null;
    state.conn = null;
    _stopHeartbeat();
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) return;
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      _reconnectDelay = Math.min(_reconnectDelay * 2, 16000);
    }, _reconnectDelay);
  }

  function _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatInterval = setInterval(() => {
      send({ type: 'CLOCK_TICK', epochMs: Date.now() });
    }, 1);
  }

  function _stopHeartbeat() {
    if (_heartbeatInterval) {
      clearInterval(_heartbeatInterval);
      _heartbeatInterval = null;
    }
  }

  function send(msg) {
    if (!_conn || _conn.open === false) return;
    msg.seq = _seq++;
    msg.sendTime = Date.now();
    try {
      _conn.send(msg);
    } catch (e) {
      console.error('send error:', e);
    }
  }

  function isConnected() {
    return _conn && _conn.open;
  }

  return { init, connect, send, isConnected };
})();
