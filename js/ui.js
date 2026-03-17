/* ============================================
   UI Rendering
   ============================================ */

const UI = {
  stageNames: {
    opening: 'Opening & Rapport',
    qualifying: 'Qualifying',
    discovery: 'Discovery',
    presentation: 'Presentation',
    closing: 'Close & Next Steps',
  },

  scoreClass(score) {
    if (score >= 7) return 'high';
    if (score >= 5) return 'mid';
    return 'low';
  },

  scoreBadgeClass(score) {
    if (score >= 7) return 'score-high';
    if (score >= 5) return 'score-mid';
    return 'score-low';
  },

  formatDate(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  },

  // --- Home View ---
  renderHome() {
    this.renderFocusCard();
    this.renderStats();
    this.renderRecentCalls();
  },

  renderFocusCard() {
    const focus = Storage.getFocusSkill();
    const nameEl = document.getElementById('focus-skill-name');
    const detailEl = document.getElementById('focus-skill-detail');
    const scoreEl = document.getElementById('focus-skill-score');

    if (!focus) {
      nameEl.textContent = '—';
      detailEl.textContent = 'Complete your first call to get a focus recommendation.';
      scoreEl.textContent = '';
      return;
    }

    nameEl.textContent = focus.name;
    detailEl.textContent = `This is your weakest area across your last ${focus.callCount} call${focus.callCount > 1 ? 's' : ''}. Focus on improving this in your next conversation.`;
    scoreEl.textContent = `Avg: ${focus.avgScore}/10`;
  },

  renderStats() {
    const stats = Storage.getStats();
    document.getElementById('stat-calls').textContent = stats.count;
    document.getElementById('stat-avg').textContent = stats.avg !== null ? stats.avg : '—';

    const trendEl = document.getElementById('stat-trend');
    if (stats.trend !== null) {
      const sign = stats.trend > 0 ? '+' : '';
      trendEl.textContent = `${sign}${stats.trend}`;
      trendEl.style.color = stats.trend > 0 ? 'var(--success)' : stats.trend < 0 ? 'var(--danger)' : '';
    } else {
      trendEl.textContent = '—';
      trendEl.style.color = '';
    }
  },

  renderRecentCalls() {
    const calls = Storage.getCalls().slice(0, 5);
    const container = document.getElementById('recent-calls');

    if (calls.length === 0) {
      container.innerHTML = '<div class="empty-state">No calls yet. Tap + to score your first call.</div>';
      return;
    }

    container.innerHTML = calls.map(c => this.renderCallItem(c)).join('');
  },

  renderCallItem(call) {
    const sc = this.scoreBadgeClass(call.overallScore);
    const focusTag = call.focusSkill ? `<span class="call-focus-tag">Focus: ${this.stageNames[call.focusSkill] || call.focusSkill}</span>` : '';

    return `
      <div class="call-item" data-call-id="${call.id}">
        <div class="call-score-badge ${sc}">${call.overallScore}</div>
        <div class="call-info">
          <div class="call-name">${this.escapeHtml(call.title || 'Untitled Call')}</div>
          <div class="call-date">${this.formatDate(call.createdAt)}</div>
          ${focusTag}
        </div>
        <div class="call-arrow">&#8250;</div>
      </div>`;
  },

  // --- History View ---
  renderHistory() {
    const calls = Storage.getCalls();
    const container = document.getElementById('history-list');

    if (calls.length === 0) {
      container.innerHTML = '<div class="empty-state">No calls scored yet.</div>';
      return;
    }

    container.innerHTML = calls.map(c => this.renderCallItem(c)).join('');
  },

  // --- Scorecard Rendering ---
  renderScorecard(result, container) {
    const stages = ['opening', 'qualifying', 'discovery', 'presentation', 'closing'];

    let html = `
      <div class="scorecard">
        <div class="scorecard-header">
          <div class="scorecard-title">Scorecard</div>
          <div class="overall-score ${this.scoreBadgeClass(result.overallScore)}" style="background: var(--${this.scoreClass(result.overallScore) === 'high' ? 'success' : this.scoreClass(result.overallScore) === 'mid' ? 'warning' : 'danger'}-light); color: var(--${this.scoreClass(result.overallScore) === 'high' ? 'success' : this.scoreClass(result.overallScore) === 'mid' ? 'warning' : 'danger'});">
            ${result.overallScore}
          </div>
        </div>`;

    for (const stage of stages) {
      const s = result.scores[stage];
      if (!s) continue;
      const cls = this.scoreClass(s.score);
      html += `
        <div class="score-row">
          <div class="score-row-header">
            <span class="score-row-name">${this.stageNames[stage]}</span>
            <span class="score-row-value" style="color: var(--${cls === 'high' ? 'success' : cls === 'mid' ? 'warning' : 'danger'})">${s.score}/10</span>
          </div>
          <div class="score-bar">
            <div class="score-bar-fill ${cls}" style="width: ${s.score * 10}%"></div>
          </div>
          <div class="score-feedback">${this.escapeHtml(s.feedback)}</div>
        </div>`;
    }

    html += '</div>';

    // Insights
    html += '<div class="card">';
    if (result.topStrength) {
      html += `<div class="insight-card"><div class="insight-label">Top Strength</div><div class="insight-text">${this.escapeHtml(result.topStrength)}</div></div>`;
    }
    if (result.topImprovement) {
      html += `<div class="insight-card" style="background: var(--warning-light)"><div class="insight-label" style="color: var(--warning)">Top Improvement</div><div class="insight-text">${this.escapeHtml(result.topImprovement)}</div></div>`;
    }
    if (result.keyMoment) {
      html += `<div class="insight-card" style="background: var(--bg)"><div class="insight-label" style="color: var(--text-secondary)">Key Moment</div><div class="insight-text">${this.escapeHtml(result.keyMoment)}</div></div>`;
    }
    html += '</div>';

    container.innerHTML = html;
  },

  // --- Metrics Rendering ---
  renderMetrics(metrics, container) {
    if (!metrics) {
      container.innerHTML = '<div class="empty-state">No metrics available.</div>';
      return;
    }

    let html = '';

    if (metrics.questionCount !== undefined) {
      const cls = (metrics.questionCount >= 11 && metrics.questionCount <= 14) ? 'metric-good' : metrics.questionCount >= 8 ? 'metric-ok' : 'metric-bad';
      html += `<div class="metric-row"><span class="metric-label">Questions Asked</span><span class="metric-value ${cls}">${metrics.questionCount} ${metrics.questionCountAssessment ? `(${metrics.questionCountAssessment})` : ''}</span></div>`;
    }

    if (metrics.talkRatioEstimate) {
      const parts = metrics.talkRatioEstimate.split('/');
      const sellerPct = parseInt(parts[0]);
      const cls = (sellerPct >= 38 && sellerPct <= 48) ? 'metric-good' : sellerPct <= 55 ? 'metric-ok' : 'metric-bad';
      html += `<div class="metric-row"><span class="metric-label">Talk Ratio (you/them)</span><span class="metric-value ${cls}">${metrics.talkRatioEstimate} ${metrics.talkRatioAssessment ? `(${metrics.talkRatioAssessment})` : ''}</span></div>`;
    }

    if (metrics.pricingDiscussed !== undefined) {
      const cls = metrics.pricingDiscussed ? 'metric-good' : 'metric-ok';
      html += `<div class="metric-row"><span class="metric-label">Pricing Discussed</span><span class="metric-value ${cls}">${metrics.pricingDiscussed ? 'Yes' : 'No'} ${metrics.pricingTiming ? `(${metrics.pricingTiming})` : ''}</span></div>`;
    }

    if (metrics.objectionHandling) {
      html += `<div class="metric-row"><span class="metric-label">Objection Handling</span><span class="metric-value">${this.escapeHtml(metrics.objectionHandling)}</span></div>`;
    }

    container.innerHTML = html;
  },

  // --- Detail View ---
  renderDetail(call) {
    const container = document.getElementById('detail-content');
    const stages = ['opening', 'qualifying', 'discovery', 'presentation', 'closing'];

    let html = `
      <button class="detail-back" id="detail-back-btn">&lsaquo; Back</button>
      <div class="detail-title">${this.escapeHtml(call.title || 'Untitled Call')}</div>
      <div class="detail-date">${new Date(call.createdAt).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>`;

    // Scorecard
    html += '<div class="scorecard">';
    html += `<div class="scorecard-header"><div class="scorecard-title">Scorecard</div><div class="overall-score ${this.scoreBadgeClass(call.overallScore)}" style="background: var(--${this.scoreClass(call.overallScore) === 'high' ? 'success' : this.scoreClass(call.overallScore) === 'mid' ? 'warning' : 'danger'}-light); color: var(--${this.scoreClass(call.overallScore) === 'high' ? 'success' : this.scoreClass(call.overallScore) === 'mid' ? 'warning' : 'danger'});">${call.overallScore}</div></div>`;

    for (const stage of stages) {
      const s = call.scores?.[stage];
      if (!s) continue;
      const cls = this.scoreClass(s.score);
      html += `
        <div class="score-row">
          <div class="score-row-header">
            <span class="score-row-name">${this.stageNames[stage]}</span>
            <span class="score-row-value" style="color: var(--${cls === 'high' ? 'success' : cls === 'mid' ? 'warning' : 'danger'})">${s.score}/10</span>
          </div>
          <div class="score-bar"><div class="score-bar-fill ${cls}" style="width: ${s.score * 10}%"></div></div>
          <div class="score-feedback">${this.escapeHtml(s.feedback)}</div>
        </div>`;
    }
    html += '</div>';

    // Insights
    if (call.topStrength || call.topImprovement || call.keyMoment) {
      html += '<div class="card">';
      if (call.topStrength) html += `<div class="insight-card"><div class="insight-label">Top Strength</div><div class="insight-text">${this.escapeHtml(call.topStrength)}</div></div>`;
      if (call.topImprovement) html += `<div class="insight-card" style="background: var(--warning-light)"><div class="insight-label" style="color: var(--warning)">Top Improvement</div><div class="insight-text">${this.escapeHtml(call.topImprovement)}</div></div>`;
      if (call.keyMoment) html += `<div class="insight-card" style="background: var(--bg)"><div class="insight-label" style="color: var(--text-secondary)">Key Moment</div><div class="insight-text">${this.escapeHtml(call.keyMoment)}</div></div>`;
      html += '</div>';
    }

    // Metrics
    if (call.metrics) {
      html += '<div class="card"><h3 style="margin-bottom:12px">Call Metrics</h3><div id="detail-metrics"></div></div>';
    }

    // AAR
    if (call.aar && Object.values(call.aar).some(v => v)) {
      const aarQs = [
        'What was supposed to happen?',
        'What actually happened?',
        'Why was there a difference?',
        'What will I do differently?',
      ];
      html += '<div class="card aar-card"><h3 style="margin-bottom:12px">After-Action Review</h3>';
      for (let i = 0; i < 4; i++) {
        const key = `q${i + 1}`;
        if (call.aar[key]) {
          html += `<div class="aar-response"><div class="aar-response-q">${aarQs[i]}</div><div class="aar-response-a">${this.escapeHtml(call.aar[key])}</div></div>`;
        }
      }
      html += '</div>';
    }

    container.innerHTML = html;

    // Render metrics after DOM insertion
    if (call.metrics) {
      this.renderMetrics(call.metrics, document.getElementById('detail-metrics'));
    }

    // Back button
    document.getElementById('detail-back-btn').addEventListener('click', () => {
      App.navigate('history');
    });
  },

  // --- Toast ---
  showToast(message, duration = 2500) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), duration);
  },

  // --- Utility ---
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
