// chart.js — Summary bar chart (pure Canvas, log scale)

const SummaryChart = (() => {
  const LABELS = ['Manual', "Cristian's", 'NTP'];
  const COLORS = ['#e05252', '#f0a030', '#4caf82'];
  const DESCRIPTIONS = [
    'Human reaction time — unpredictable, ~100-500ms',
    'RTT-based estimate — deterministic, ~10-50ms',
    'OS time already synced — just coordinate, ~1-15ms',
  ];

  function draw() {
    const canvas = document.getElementById('summary-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 260;

    ctx.clearRect(0, 0, W, H);

    const values = [
      state.results.manual,
      state.results.cristian,
      state.results.ntp,
    ];

    const hasData = values.some(v => v != null);
    if (!hasData) {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Run each step to see results', W / 2, H / 2);
      return;
    }

    const PAD_LEFT = 80;
    const PAD_RIGHT = 20;
    const PAD_TOP = 20;
    const PAD_BOT = 30;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOT;

    const LOG_MIN = 0;
    const LOG_MAX = 3;

    function xForMs(ms) {
      if (!ms || ms <= 0) return PAD_LEFT;
      const log = Math.log10(Math.max(ms, 1));
      return PAD_LEFT + ((log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * chartW;
    }

    [1, 10, 100, 1000].forEach(ms => {
      const x = xForMs(ms);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#666';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ms}ms`, x, H - 6);
    });

    const barH = Math.min(36, (chartH / 3) - 12);
    const groupH = chartH / 3;

    values.forEach((val, i) => {
      const y = PAD_TOP + i * groupH + (groupH - barH) / 2;
      const color = COLORS[i];

      ctx.fillStyle = '#ccc';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(LABELS[i], PAD_LEFT - 8, y + barH / 2 + 4);

      if (val != null && val > 0) {
        const barW = xForMs(val) - PAD_LEFT;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(PAD_LEFT, y, barW, barH, 4);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(val)}ms`, PAD_LEFT + barW + 6, y + barH / 2 + 5);
      } else {
        ctx.fillStyle = '#444';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('not run', PAD_LEFT + 4, y + barH / 2 + 5);
      }
    });
  }

  function drawDescriptions() {
    const container = document.getElementById('summary-descriptions');
    if (!container) return;
    const values = [state.results.manual, state.results.cristian, state.results.ntp];
    container.innerHTML = LABELS.map((label, i) => `
      <div class="summary-row">
        <span class="summary-dot" style="background:${COLORS[i]}"></span>
        <span class="summary-label">${label}</span>
        <span class="summary-ms">${values[i] != null ? Math.round(values[i]) + 'ms' : '—'}</span>
        <span class="summary-desc">${DESCRIPTIONS[i]}</span>
      </div>
    `).join('');
  }

  function update() {
    draw();
    drawDescriptions();
  }

  return { update };
})();
