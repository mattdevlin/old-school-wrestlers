/* ============================================
   App — Main Controller & Router
   ============================================ */

const App = {
  currentView: 'home',
  currentResult: null,

  init() {
    this.bindNavigation();
    this.bindSettings();
    this.bindNewCall();
    this.loadSettings();
    this.navigate('home');
    this.registerServiceWorker();
  },

  // --- Navigation ---
  navigate(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show target
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    this.currentView = viewName;

    // Scroll to top
    document.getElementById('views').scrollTop = 0;

    // View-specific rendering
    if (viewName === 'home') UI.renderHome();
    if (viewName === 'history') UI.renderHistory();
    if (viewName === 'new') this.resetNewCallForm();
  },

  bindNavigation() {
    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.navigate('settings');
    });

    // Call item clicks (delegated)
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.call-item');
      if (item) {
        const id = item.dataset.callId;
        this.showCallDetail(id);
      }
    });
  },

  // --- Settings ---
  bindSettings() {
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const apiKey = document.getElementById('api-key').value.trim();
      const model = document.getElementById('model-select').value;
      const productContext = document.getElementById('product-context').value.trim();

      Storage.saveSettings({ apiKey, model, productContext });
      UI.showToast('Settings saved');
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salesrep-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Data exported');
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
      if (confirm('Delete all call history? This cannot be undone. Your settings and API key will be kept.')) {
        Storage.clearAll();
        UI.showToast('Call data cleared');
        this.navigate('home');
      }
    });
  },

  loadSettings() {
    const settings = Storage.getSettings();
    if (settings.apiKey) document.getElementById('api-key').value = settings.apiKey;
    if (settings.model) document.getElementById('model-select').value = settings.model;
    if (settings.productContext) document.getElementById('product-context').value = settings.productContext;
  },

  // --- New Call ---
  bindNewCall() {
    document.getElementById('btn-score').addEventListener('click', () => this.scoreCall());
    document.getElementById('btn-save-call').addEventListener('click', () => this.saveCall());
  },

  resetNewCallForm() {
    document.getElementById('new-call-step-1').style.display = 'block';
    document.getElementById('new-call-step-2').style.display = 'none';
    this.currentResult = null;
    // Don't clear form fields — user might navigate away and back
  },

  async scoreCall() {
    const transcript = document.getElementById('call-transcript').value.trim();
    if (!transcript) {
      UI.showToast('Paste a transcript first');
      return;
    }

    if (!Storage.getApiKey()) {
      UI.showToast('Add your API key in Settings first');
      this.navigate('settings');
      return;
    }

    const context = document.getElementById('call-context').value.trim();
    const btn = document.getElementById('btn-score');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';

    // Remove any previous error
    const existingError = document.querySelector('#new-call-step-1 .error-msg');
    if (existingError) existingError.remove();

    try {
      const result = await API.scoreTranscript(transcript, context);
      this.currentResult = result;

      // Render scorecard
      UI.renderScorecard(result, document.getElementById('scorecard-results'));

      // Render metrics
      UI.renderMetrics(result.metrics, document.getElementById('metrics-content'));

      // Clear AAR fields
      for (let i = 1; i <= 4; i++) {
        document.getElementById(`aar-${i}`).value = '';
      }

      // Show step 2
      document.getElementById('new-call-step-1').style.display = 'none';
      document.getElementById('new-call-step-2').style.display = 'block';

      // Scroll to top
      document.getElementById('views').scrollTop = 0;

    } catch (err) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-msg';
      errorDiv.textContent = err.message;
      document.querySelector('#new-call-step-1 .card').prepend(errorDiv);
    } finally {
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  },

  saveCall() {
    if (!this.currentResult) return;

    const title = document.getElementById('call-title').value.trim() || 'Untitled Call';
    const transcript = document.getElementById('call-transcript').value.trim();
    const context = document.getElementById('call-context').value.trim();

    // Get AAR
    const aar = {
      q1: document.getElementById('aar-1').value.trim(),
      q2: document.getElementById('aar-2').value.trim(),
      q3: document.getElementById('aar-3').value.trim(),
      q4: document.getElementById('aar-4').value.trim(),
    };

    // Get current focus skill (what was recommended before this call)
    const focus = Storage.getFocusSkill();

    const call = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      transcript,
      context,
      createdAt: new Date().toISOString(),
      overallScore: this.currentResult.overallScore,
      scores: this.currentResult.scores,
      metrics: this.currentResult.metrics,
      topStrength: this.currentResult.topStrength,
      topImprovement: this.currentResult.topImprovement,
      keyMoment: this.currentResult.keyMoment,
      aar,
      focusSkill: focus ? focus.key : null,
    };

    Storage.saveCall(call);
    this.currentResult = null;

    // Clear form
    document.getElementById('call-title').value = '';
    document.getElementById('call-transcript').value = '';
    document.getElementById('call-context').value = '';

    UI.showToast('Call saved');
    this.navigate('home');
  },

  // --- Call Detail ---
  showCallDetail(id) {
    const call = Storage.getCall(id);
    if (!call) return;
    UI.renderDetail(call);
    // Show detail view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-detail').classList.add('active');
    document.getElementById('views').scrollTop = 0;
  },

  // --- Service Worker ---
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // SW registration failed — app still works without it
      });
    }
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
