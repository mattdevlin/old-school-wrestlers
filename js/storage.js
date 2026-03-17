/* ============================================
   Storage Layer — localStorage with JSON
   ============================================ */

const Storage = {
  KEYS: {
    CALLS: 'salesrep_calls',
    SETTINGS: 'salesrep_settings',
  },

  // --- Calls ---
  getCalls() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.CALLS)) || [];
    } catch {
      return [];
    }
  },

  saveCall(call) {
    const calls = this.getCalls();
    calls.unshift(call); // newest first
    localStorage.setItem(this.KEYS.CALLS, JSON.stringify(calls));
  },

  getCall(id) {
    return this.getCalls().find(c => c.id === id) || null;
  },

  deleteCall(id) {
    const calls = this.getCalls().filter(c => c.id !== id);
    localStorage.setItem(this.KEYS.CALLS, JSON.stringify(calls));
  },

  // --- Settings ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS)) || {};
    } catch {
      return {};
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  getApiKey() {
    return this.getSettings().apiKey || '';
  },

  getModel() {
    return this.getSettings().model || 'claude-sonnet-4-20250514';
  },

  getProductContext() {
    return this.getSettings().productContext || '';
  },

  // --- Stats ---
  getStats() {
    const calls = this.getCalls();
    const count = calls.length;
    if (count === 0) return { count: 0, avg: null, trend: null };

    const avg = calls.reduce((sum, c) => sum + (c.overallScore || 0), 0) / count;

    // Trend: compare last 3 vs previous 3
    let trend = null;
    if (count >= 6) {
      const recent3 = calls.slice(0, 3).reduce((s, c) => s + (c.overallScore || 0), 0) / 3;
      const prev3 = calls.slice(3, 6).reduce((s, c) => s + (c.overallScore || 0), 0) / 3;
      trend = recent3 - prev3;
    } else if (count >= 2) {
      trend = (calls[0].overallScore || 0) - (calls[calls.length - 1].overallScore || 0);
    }

    return { count, avg: Math.round(avg * 10) / 10, trend: trend !== null ? Math.round(trend * 10) / 10 : null };
  },

  // --- Focus Skill ---
  getFocusSkill() {
    const calls = this.getCalls();
    if (calls.length === 0) return null;

    // Use last 5 calls (or fewer)
    const recent = calls.slice(0, 5);
    const stages = ['opening', 'qualifying', 'discovery', 'presentation', 'closing'];
    const stageNames = {
      opening: 'Opening & Rapport',
      qualifying: 'Qualifying',
      discovery: 'Discovery',
      presentation: 'Presentation',
      closing: 'Close & Next Steps'
    };

    let weakest = null;
    let lowestAvg = Infinity;

    for (const stage of stages) {
      const scores = recent
        .filter(c => c.scores && c.scores[stage])
        .map(c => c.scores[stage].score);
      if (scores.length === 0) continue;
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakest = stage;
      }
    }

    if (!weakest) return null;

    return {
      key: weakest,
      name: stageNames[weakest],
      avgScore: Math.round(lowestAvg * 10) / 10,
      callCount: recent.length,
    };
  },

  // --- Export ---
  exportAll() {
    return JSON.stringify({
      calls: this.getCalls(),
      settings: { ...this.getSettings(), apiKey: '[REDACTED]' },
      exportedAt: new Date().toISOString(),
    }, null, 2);
  },

  clearAll() {
    localStorage.removeItem(this.KEYS.CALLS);
    // Keep settings (API key etc)
  }
};
