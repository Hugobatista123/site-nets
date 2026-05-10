/* ===========================================================
 * storage.js
 * Camada única de acesso ao localStorage.
 * Mantém compatibilidade com os dados antigos:
 *   - localStorage["sessions"]  (array de sessões)
 *   - localStorage["processes"] (array de processos)
 * E adiciona:
 *   - localStorage["attendance_v1"] (contador diário com categorias)
 *   - localStorage["ui_prefs_v1"]   (preferências de visualização)
 * =========================================================== */

const AppData = {
  sessions: [],
  processes: [],

  // -------- Carregar dados existentes --------
  load() {
    try {
      this.sessions = JSON.parse(localStorage.getItem('sessions')) || [];
    } catch (_) { this.sessions = []; }
    try {
      this.processes = JSON.parse(localStorage.getItem('processes')) || [];
    } catch (_) { this.processes = []; }

    // Garante campos mínimos em registros antigos
    this.sessions.forEach(s => {
      if (!s.id) s.id = AppData.generateId();
      if (!s.createdAt) s.createdAt = new Date().toISOString();
    });
    this.processes.forEach(p => {
      if (!p.id) p.id = AppData.generateId();
      if (!p.createdAt) p.createdAt = new Date().toISOString();
      if (!Array.isArray(p.tags)) p.tags = [];
    });
  },

  saveToLocalStorage() {
    localStorage.setItem('sessions', JSON.stringify(this.sessions));
    localStorage.setItem('processes', JSON.stringify(this.processes));
    this.updateStats();
    if (typeof this.updateJsonPreview === 'function') this.updateJsonPreview();
  },

  updateStats() {
    const s = document.getElementById('sessionsCount');
    const p = document.getElementById('processesCount');
    if (s) s.textContent = this.sessions.length;
    if (p) p.textContent = this.processes.length;
  },

  getSessionById(id) {
    return this.sessions.find(s => s.id === id);
  },

  getProcessesBySession(sessionId) {
    if (!sessionId) return this.processes;
    return this.processes.filter(p => p.sessionId === sessionId);
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
};

// -------- Preferências de UI (persistentes) --------
const UIPrefs = {
  KEY: 'ui_prefs_v1',
  data: { viewMode: 'cards', itemsPerPage: 20, sortBy: 'newest' },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY));
      if (saved) Object.assign(this.data, saved);
    } catch (_) { /* mantém defaults */ }
    return this.data;
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  set(key, value) {
    this.data[key] = value;
    this.save();
  }
};

// Carrega ao definir
AppData.load();
UIPrefs.load();
