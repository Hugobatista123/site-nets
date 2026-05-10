/* ===========================================================
 * contador.js
 * Contador de atendimentos diários com categorias e histórico.
 * Estrutura no localStorage (chave "attendance_v1"):
 * {
 *   "2026-05-10": { normal: 5, urgente: 2, pendente: 1, resolvido: 3 },
 *   "2026-05-09": { normal: 8, urgente: 0, pendente: 2, resolvido: 6 }
 * }
 * =========================================================== */

const Counter = {
  KEY: 'attendance_v1',
  CATEGORIES: [
    { id: 'normal',    label: 'Normal',    icon: 'fa-circle',          color: 'var(--secondary)' },
    { id: 'urgente',   label: 'Urgente',   icon: 'fa-bolt',            color: 'var(--danger)'    },
    { id: 'pendente',  label: 'Pendente',  icon: 'fa-clock',           color: 'var(--warning)'   },
    { id: 'resolvido', label: 'Resolvido', icon: 'fa-circle-check',    color: 'var(--success)'   }
  ],

  data: {},
  todayKey: '',

  // ---- Inicialização ----
  init() {
    this.todayKey = this._dateKey(new Date());
    this._loadData();
    this._ensureToday();
    this._renderBar();
    this._bindEvents();
    this.refreshDisplay();
  },

  _dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _formatDateBR(isoKey) {
    const [y, m, d] = isoKey.split('-');
    return `${d}/${m}/${y}`;
  },

  _loadData() {
    try {
      this.data = JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch (_) {
      this.data = {};
    }
  },

  _save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  _ensureToday() {
    if (!this.data[this.todayKey]) {
      this.data[this.todayKey] = this._emptyDay();
      this._save();
    } else {
      // Garante que todas as categorias existem (ex: ao adicionar nova categoria depois)
      const empty = this._emptyDay();
      this.data[this.todayKey] = { ...empty, ...this.data[this.todayKey] };
    }
  },

  _emptyDay() {
    const obj = {};
    this.CATEGORIES.forEach(c => obj[c.id] = 0);
    return obj;
  },

  // ---- API pública ----
  add(category) {
    if (!this._validCategory(category)) return;
    this._ensureToday();
    this.data[this.todayKey][category] = (this.data[this.todayKey][category] || 0) + 1;
    this._save();
    this.refreshDisplay();
    pulseEl(`#counter-cat-${category}`);
  },

  remove(category) {
    if (!this._validCategory(category)) return;
    this._ensureToday();
    const cur = this.data[this.todayKey][category] || 0;
    if (cur > 0) {
      this.data[this.todayKey][category] = cur - 1;
      this._save();
      this.refreshDisplay();
    }
  },

  resetToday() {
    this.data[this.todayKey] = this._emptyDay();
    this._save();
    this.refreshDisplay();
  },

  totalToday() {
    const day = this.data[this.todayKey] || {};
    return this.CATEGORIES.reduce((sum, c) => sum + (day[c.id] || 0), 0);
  },

  _validCategory(cat) {
    return this.CATEGORIES.some(c => c.id === cat);
  },

  // ---- Renderização da barra fixa ----
  _renderBar() {
    const bar = document.getElementById('counterBar');
    if (!bar) return;

    const catsHtml = this.CATEGORIES.map(c => `
      <button class="counter-cat-btn" id="counter-cat-${c.id}"
              data-category="${c.id}" title="Adicionar 1 ${c.label}">
        <i class="fas ${c.icon}" style="color:${c.color}"></i>
        <span class="counter-cat-label">${c.label}</span>
        <span class="counter-cat-value" data-value="${c.id}">0</span>
      </button>
    `).join('');

    bar.innerHTML = `
      <div class="counter-info">
        <div class="counter-title">
          <i class="fas fa-headset"></i>
          <span>Atendimentos</span>
        </div>
        <div class="counter-date" id="counterDate">—</div>
      </div>

      <div class="counter-total">
        <span class="counter-total-label">Total hoje</span>
        <span class="counter-total-value" id="counterTotalValue">0</span>
      </div>

      <div class="counter-categories">${catsHtml}</div>

      <div class="counter-actions">
        <button class="counter-action-btn" id="counterRemoveBtn"
                title="Remover 1 da última categoria clicada">
          <i class="fas fa-minus"></i>
        </button>
        <button class="counter-action-btn" id="counterHistoryBtn" title="Ver histórico">
          <i class="fas fa-calendar-days"></i>
        </button>
        <button class="counter-action-btn danger" id="counterResetBtn" title="Zerar contador do dia">
          <i class="fas fa-rotate-left"></i>
        </button>
        <button class="counter-action-btn" id="counterToggleBtn" title="Recolher/expandir">
          <i class="fas fa-chevron-up"></i>
        </button>
      </div>
    `;
  },

  _bindEvents() {
    const bar = document.getElementById('counterBar');
    if (!bar) return;

    // Cliques nas categorias = +1
    bar.querySelectorAll('.counter-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        this._lastCategory = cat;
        this.add(cat);
      });
    });

    // Botão remover (-1) — usa última categoria clicada ou "normal"
    document.getElementById('counterRemoveBtn').addEventListener('click', () => {
      const cat = this._lastCategory || 'normal';
      this.remove(cat);
    });

    // Botão zerar (com confirmação)
    document.getElementById('counterResetBtn').addEventListener('click', () => {
      if (typeof showConfirmModal === 'function') {
        showConfirmModal(
          'Zerar contador',
          `Tem certeza que deseja zerar o contador de hoje (${this._formatDateBR(this.todayKey)})?`,
          () => {
            this.resetToday();
            if (typeof showNotification === 'function') showNotification('Contador zerado!', 'success');
          }
        );
      } else if (confirm('Zerar contador de hoje?')) {
        this.resetToday();
      }
    });

    // Histórico
    document.getElementById('counterHistoryBtn').addEventListener('click', () => this.openHistory());

    // Toggle recolher/expandir
    document.getElementById('counterToggleBtn').addEventListener('click', () => {
      bar.classList.toggle('collapsed');
      const icon = bar.querySelector('#counterToggleBtn i');
      if (icon) {
        icon.className = bar.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
    });

    // Atalhos de teclado: + e - quando não estiver em campo de texto
    document.addEventListener('keydown', (e) => {
      if (this._isTyping(e.target)) return;
      if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
        this.add(this._lastCategory || 'normal');
      } else if (e.key === '-' || e.key === '_') {
        this.remove(this._lastCategory || 'normal');
      }
    });
  },

  _isTyping(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  },

  // ---- Atualizar valores visíveis ----
  refreshDisplay() {
    const dateEl = document.getElementById('counterDate');
    if (dateEl) dateEl.textContent = this._formatDateBR(this.todayKey);

    const day = this.data[this.todayKey] || this._emptyDay();
    this.CATEGORIES.forEach(c => {
      const el = document.querySelector(`[data-value="${c.id}"]`);
      if (el) el.textContent = day[c.id] || 0;
    });

    const totalEl = document.getElementById('counterTotalValue');
    if (totalEl) totalEl.textContent = this.totalToday();
  },

  // ---- Modal de Histórico ----
  openHistory() {
    const modal = document.getElementById('historyModal');
    const content = document.getElementById('historyContent');
    if (!modal || !content) return;

    const days = Object.keys(this.data).sort().reverse();

    if (days.length === 0) {
      content.innerHTML = '<p class="text-light">Nenhum dado de atendimento ainda.</p>';
    } else {
      const totalGeral = days.reduce((sum, d) => {
        return sum + this.CATEGORIES.reduce((s, c) => s + (this.data[d][c.id] || 0), 0);
      }, 0);

      const rowsHtml = days.map(dayKey => {
        const day = this.data[dayKey];
        const total = this.CATEGORIES.reduce((s, c) => s + (day[c.id] || 0), 0);
        const cells = this.CATEGORIES.map(c =>
          `<td><span class="badge" style="background:${c.color}33;color:${c.color}">${day[c.id] || 0}</span></td>`
        ).join('');
        const isToday = dayKey === this.todayKey;
        return `
          <tr class="${isToday ? 'history-today' : ''}">
            <td><strong>${this._formatDateBR(dayKey)}${isToday ? ' (hoje)' : ''}</strong></td>
            ${cells}
            <td><strong>${total}</strong></td>
          </tr>
        `;
      }).join('');

      const headerCats = this.CATEGORIES.map(c =>
        `<th><i class="fas ${c.icon}" style="color:${c.color}"></i> ${c.label}</th>`
      ).join('');

      content.innerHTML = `
        <div class="history-summary">
          <span><strong>${days.length}</strong> dia(s) registrado(s)</span>
          <span><strong>${totalGeral}</strong> atendimento(s) no total</span>
        </div>
        <div class="history-table-wrapper">
          <table class="history-table">
            <thead>
              <tr>
                <th>Data</th>
                ${headerCats}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="history-actions">
          <button class="btn-secondary" id="exportHistoryBtn">
            <i class="fas fa-download"></i> Exportar CSV
          </button>
          <button class="btn-danger" id="clearHistoryBtn">
            <i class="fas fa-trash"></i> Limpar histórico
          </button>
        </div>
      `;

      document.getElementById('exportHistoryBtn').addEventListener('click', () => this._exportCsv());
      document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if (typeof showConfirmModal === 'function') {
          showConfirmModal('Limpar histórico',
            'Apagar TODO o histórico de atendimentos? Esta ação não pode ser desfeita.',
            () => {
              this.data = {};
              this._ensureToday();
              this._save();
              this.refreshDisplay();
              this.openHistory();
              if (typeof showNotification === 'function') showNotification('Histórico apagado!', 'success');
            }
          );
        }
      });
    }

    modal.classList.add('active');
  },

  _exportCsv() {
    const days = Object.keys(this.data).sort();
    const header = ['Data', ...this.CATEGORIES.map(c => c.label), 'Total'];
    const rows = days.map(d => {
      const day = this.data[d];
      const total = this.CATEGORIES.reduce((s, c) => s + (day[c.id] || 0), 0);
      return [this._formatDateBR(d), ...this.CATEGORIES.map(c => day[c.id] || 0), total].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atendimentos-${this.todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Helper visual: efeito "pulse" ao adicionar
function pulseEl(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth; // força reflow
  el.classList.add('pulse');
}
