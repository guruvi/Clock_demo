// ntp.js — NTP-style coordination: schedule playback by absolute epoch time

const NTPSync = (() => {
  // Called by host when "Play (NTP)" is pressed
  function schedulePlay() {
    VideoManager.resetForStep();
    const playAtEpoch = Date.now() + 2000;
    PeerManager.send({ type: 'NTP_PLAY_AT', epochMs: playAtEpoch });
    VideoManager.schedulePlay(playAtEpoch);
    _showScheduled(playAtEpoch);
  }

  // Called on guest when NTP_PLAY_AT arrives
  function handlePlayAt(msg) {
    VideoManager.resetForStep();
    VideoManager.schedulePlay(msg.epochMs);
    _showScheduled(msg.epochMs);
  }

  function _showScheduled(epochMs) {
    const el = document.getElementById('ntp-scheduled-time');
    if (el) {
      const d = new Date(epochMs);
      el.textContent = `Playing at: ${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`;
      el.style.display = 'block';
    }
  }

  return { schedulePlay, handlePlayAt };
})();
