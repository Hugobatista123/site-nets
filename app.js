/* ===========================================================
 * app.js
 * Lógica principal: sessões, processos, filtros, modos de
 * visualização (cards / lista / tabela), export/import,
 * navegação, modal e notificações.
 * Depende de: storage.js, contador.js
 * =========================================================== */

// ---------- Estado global ----------
const filterState = {
  selectedTags: new Set(),
  sortBy: UIPrefs.data.sortBy || 'newest',
  itemsPerPage: UIPrefs.data.itemsPerPage || 20,
  currentPage: 1,
  searchTerm: '',
  selectedSession: ''
};

let elements = {};
let editingSessionId = null;
let editingProcessId = null;
let modalCallback = null;

// =====================================================
// HELPERS
// =====================================================
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Normaliza texto para busca: minúsculas, sem acentos, e qualquer
// caractere não-alfanumérico vira espaço único. Isso faz com que
// "check-in", "check in" e "Check-In" sejam equivalentes na busca,
// e que "devolucao" encontre "Devolução".
function normalizeForSearch(text) {
  if (text == null) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function showNotification(message, type = 'success') {
  const n = elements.notification || document.getElementById('notification');
  if (!n) return;
  const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b' };
  n.style.backgroundColor = colors[type] || colors.success;
  n.textContent = message;
  n.classList.add('show');
  clearTimeout(n._timer);
  n._timer = setTimeout(() => n.classList.remove('show'), 2500);
}

function showConfirmModal(title, message, callback) {
  const modal = document.getElementById('confirmModal');
  const t = document.getElementById('modalTitle');
  const m = document.getElementById('modalMessage');
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  modalCallback = callback;
  if (modal) modal.classList.add('active');
}

// =====================================================
// CACHE DE ELEMENTOS
// =====================================================
function getElements() {
  return {
    navBtns: document.querySelectorAll('.nav-btn'),
    sessionForm: document.getElementById('sessionForm'),
    sessionName: document.getElementById('sessionName'),
    sessionDescription: document.getElementById('sessionDescription'),
    sessionColor: document.getElementById('sessionColor'),
    addSessionBtn: document.getElementById('addSessionBtn'),
    saveSessionBtn: document.getElementById('saveSessionBtn'),
    cancelSessionBtn: document.getElementById('cancelSessionBtn'),
    sessionsContainer: document.getElementById('sessionsContainer'),

    processTitle: document.getElementById('processTitle'),
    processDescription: document.getElementById('processDescription'),
    processSession: document.getElementById('processSession'),
    processColor: document.getElementById('processColor'),
    processTags: document.getElementById('processTags'),
    addProcessBtn: document.getElementById('addProcessBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    sessionSelect: document.getElementById('sessionSelect'),
    searchProcesses: document.getElementById('searchProcesses'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    processesContainer: document.getElementById('processesContainer'),
    pagination: document.getElementById('pagination'),

    exportAllBtn: document.getElementById('exportAllBtn'),
    exportSessionsBtn: document.getElementById('exportSessionsBtn'),
    exportProcessesBtn: document.getElementById('exportProcessesBtn'),
    importFile: document.getElementById('importFile'),
    chooseFileBtn: document.getElementById('chooseFileBtn'),
    fileName: document.getElementById('fileName'),
    importBtn: document.getElementById('importBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    jsonPreview: document.getElementById('jsonPreview'),
    jsonTabs: document.querySelectorAll('.json-tab'),

    confirmModal: document.getElementById('confirmModal'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),

    notification: document.getElementById('notification'),
    backToTopBtn: document.getElementById('backToTop'),

    viewModeBtns: document.querySelectorAll('.view-mode-btn')
  };
}

// =====================================================
// SESSÕES
// =====================================================
function loadSessionSelects() {
  const sel = elements.sessionSelect;
  const procSel = elements.processSession;
  if (!sel || !procSel) return;

  while (sel.options.length > 1) sel.remove(1);
  procSel.innerHTML = '';

  AppData.sessions.forEach(s => {
    const o1 = document.createElement('option');
    o1.value = s.id; o1.textContent = s.name;
    sel.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = s.id; o2.textContent = s.name;
    procSel.appendChild(o2);
  });

  if (AppData.sessions.length === 0) {
    const o = document.createElement('option');
    o.value = ''; o.disabled = true;
    o.textContent = 'Crie uma sessão primeiro';
    procSel.appendChild(o);
  }
}

function renderSessions() {
  const c = elements.sessionsContainer;
  if (!c) return;
  c.innerHTML = '';

  if (AppData.sessions.length === 0) {
    c.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group fa-3x"></i>
        <h3>Nenhuma sessão criada</h3>
        <p>Crie sua primeira sessão para organizar os processos.</p>
      </div>`;
    return;
  }

  AppData.sessions.forEach(s => {
    const procs = AppData.getProcessesBySession(s.id);
    const card = document.createElement('div');
    card.className = 'session-card';
    card.style.borderLeftColor = s.color;
    card.innerHTML = `
      <div class="session-header">
        <div class="session-title">
          <span class="session-color" style="background:${s.color}"></span>
          ${escapeHtml(s.name)}
        </div>
        <div class="session-actions-top">
          <button class="icon-btn edit-session" data-id="${s.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="icon-btn danger delete-session" data-id="${s.id}" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="session-description">${escapeHtml(s.description) || '<span class="text-light">Sem descrição</span>'}</div>
      <div class="session-stats">
        <span><i class="fas fa-tasks"></i> ${procs.length} processo(s)</span>
        <span><i class="fas fa-calendar"></i> ${new Date(s.createdAt).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="session-actions">
        <button class="btn-primary view-session" data-id="${s.id}">
          <i class="fas fa-eye"></i> Ver Processos
        </button>
      </div>`;
    c.appendChild(card);
  });

  c.querySelectorAll('.edit-session').forEach(b =>
    b.addEventListener('click', e => editSession(e.currentTarget.dataset.id)));
  c.querySelectorAll('.delete-session').forEach(b =>
    b.addEventListener('click', e => deleteSession(e.currentTarget.dataset.id)));
  c.querySelectorAll('.view-session').forEach(b =>
    b.addEventListener('click', e => viewSessionProcesses(e.currentTarget.dataset.id)));
}

function saveSession() {
  const name = elements.sessionName.value.trim();
  const description = elements.sessionDescription.value.trim();
  const color = elements.sessionColor.value || '#6a1bb1';

  if (!name) {
    showNotification('Digite um nome para a sessão!', 'error');
    elements.sessionName.focus();
    return;
  }

  if (editingSessionId) {
    const i = AppData.sessions.findIndex(s => s.id === editingSessionId);
    if (i !== -1) {
      AppData.sessions[i] = { ...AppData.sessions[i], name, description, color, updatedAt: new Date().toISOString() };
    }
  } else {
    AppData.sessions.unshift({
      id: AppData.generateId(),
      name, description, color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  AppData.saveToLocalStorage();
  loadSessionSelects();
  renderSessions();
  resetSessionForm();
  elements.sessionForm.style.display = 'none';
  showNotification(editingSessionId ? 'Sessão atualizada!' : 'Sessão criada!');
  editingSessionId = null;
}

function editSession(id) {
  const s = AppData.getSessionById(id);
  if (!s) return;
  editingSessionId = id;
  elements.sessionName.value = s.name;
  elements.sessionDescription.value = s.description || '';
  elements.sessionColor.value = s.color;
  elements.sessionForm.style.display = 'block';
  elements.sessionName.focus();
  elements.saveSessionBtn.textContent = 'Atualizar Sessão';
}

function deleteSession(id) {
  const s = AppData.getSessionById(id);
  if (!s) return;
  const procs = AppData.getProcessesBySession(id);
  showConfirmModal(
    'Excluir Sessão',
    `Excluir "${s.name}"?` + (procs.length ? ` Isso também removerá ${procs.length} processo(s) vinculado(s).` : ''),
    () => {
      AppData.sessions = AppData.sessions.filter(x => x.id !== id);
      AppData.processes = AppData.processes.filter(p => p.sessionId !== id);
      AppData.saveToLocalStorage();
      loadSessionSelects();
      renderSessions();
      renderTagsFilter();
      renderProcessesWithFilters();
      showNotification('Sessão excluída!');
    }
  );
}

function resetSessionForm() {
  elements.sessionName.value = '';
  elements.sessionDescription.value = '';
  elements.sessionColor.value = '#6a1bb1';
  editingSessionId = null;
  elements.saveSessionBtn.textContent = 'Salvar Sessão';
}

function viewSessionProcesses(id) {
  switchTab('processes-section');
  if (elements.sessionSelect) elements.sessionSelect.value = id;
  filterState.selectedSession = id;
  filterState.currentPage = 1;
  renderProcessesWithFilters();
}

// =====================================================
// PROCESSOS — CRUD
// =====================================================
function addProcess() {
  const title = elements.processTitle.value.trim();
  const description = elements.processDescription.value.trim();
  const sessionId = elements.processSession.value;
  const color = elements.processColor.value || '#3b82f6';
  const tags = elements.processTags.value.split(',').map(t => t.trim()).filter(Boolean);

  if (!title)       { showNotification('Digite um título!', 'error'); elements.processTitle.focus(); return; }
  if (!description) { showNotification('Digite uma descrição!', 'error'); elements.processDescription.focus(); return; }
  if (!sessionId)   { showNotification('Selecione uma sessão!', 'error'); elements.processSession.focus(); return; }

  if (editingProcessId) {
    const i = AppData.processes.findIndex(p => p.id === editingProcessId);
    if (i !== -1) {
      AppData.processes[i] = {
        ...AppData.processes[i],
        title, description, sessionId, color, tags,
        updatedAt: new Date().toISOString()
      };
    }
    showNotification('Processo atualizado!');
  } else {
    AppData.processes.unshift({
      id: AppData.generateId(),
      title, description, sessionId, color, tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    showNotification('Processo adicionado!');
  }

  AppData.saveToLocalStorage();
  resetProcessForm();
  renderTagsFilter();
  renderProcessesWithFilters();
}

function resetProcessForm() {
  elements.processTitle.value = '';
  elements.processDescription.value = '';
  elements.processColor.value = '#3b82f6';
  elements.processTags.value = '';
  editingProcessId = null;
  elements.addProcessBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Processo';
  if (elements.cancelEditBtn) elements.cancelEditBtn.style.display = 'none';
  const t = document.getElementById('processFormTitle');
  if (t) t.textContent = 'Adicionar Novo Processo';
}

function editProcess(id) {
  const p = AppData.processes.find(x => x.id === id);
  if (!p) return;
  editingProcessId = id;
  elements.processTitle.value = p.title;
  elements.processDescription.value = p.description;
  elements.processSession.value = p.sessionId;
  elements.processColor.value = p.color;
  elements.processTags.value = (p.tags || []).join(', ');
  elements.addProcessBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
  if (elements.cancelEditBtn) elements.cancelEditBtn.style.display = 'inline-flex';
  const t = document.getElementById('processFormTitle');
  if (t) t.textContent = `Editando: ${p.title}`;
  switchTab('processes-section');
  elements.processTitle.scrollIntoView({ behavior: 'smooth', block: 'center' });
  elements.processTitle.focus();
}

function deleteProcess(id) {
  const p = AppData.processes.find(x => x.id === id);
  if (!p) return;
  showConfirmModal('Excluir Processo', `Excluir "${p.title}"?`, () => {
    AppData.processes = AppData.processes.filter(x => x.id !== id);
    AppData.saveToLocalStorage();
    renderTagsFilter();
    renderProcessesWithFilters();
    showNotification('Processo excluído!');
  });
}

function copyProcess(id) {
  const p = AppData.processes.find(x => x.id === id);
  if (!p) return;
  const text = `${p.title}\n\n${p.description}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showNotification('Copiado para a área de transferência!'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showNotification('Copiado!'); }
  catch (_) { showNotification('Erro ao copiar', 'error'); }
  document.body.removeChild(ta);
}

// =====================================================
// FILTROS + TAGS
// =====================================================
function getAllUniqueTags() {
  const set = new Set();
  AppData.processes.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function renderTagsFilter() {
  const c = document.getElementById('tagsFilterContainer');
  if (!c) return;
  const tags = getAllUniqueTags();

  if (tags.length === 0) {
    c.innerHTML = '<p class="text-light">Nenhuma tag disponível</p>';
    return;
  }

  c.innerHTML = '';
  tags.forEach(tag => {
    const label = document.createElement('label');
    const sel = filterState.selectedTags.has(tag);
    label.className = `tag-checkbox ${sel ? 'selected' : ''}`;
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(tag)}" ${sel ? 'checked' : ''}> ${escapeHtml(tag)}`;
    label.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) filterState.selectedTags.add(tag);
      else filterState.selectedTags.delete(tag);
      label.classList.toggle('selected', e.target.checked);
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
    c.appendChild(label);
  });
}

function applyFilters(processes) {
  let out = [...processes];

  if (filterState.selectedSession) {
    out = out.filter(p => p.sessionId === filterState.selectedSession);
  }

  if (filterState.searchTerm) {
    const tokens = normalizeForSearch(filterState.searchTerm).split(' ').filter(Boolean);
    if (tokens.length > 0) {
      out = out.filter(p => {
        const haystack = normalizeForSearch(
          (p.title || '') + ' ' + (p.description || '') + ' ' + (p.tags || []).join(' ')
        );
        return tokens.every(t => haystack.includes(t));
      });
    }
  }

  if (filterState.selectedTags.size > 0) {
    out = out.filter(p =>
      Array.isArray(p.tags) && p.tags.length > 0 &&
      Array.from(filterState.selectedTags).every(t => p.tags.includes(t))
    );
  }

  out.sort((a, b) => {
    switch (filterState.sortBy) {
      case 'oldest': return new Date(a.createdAt) - new Date(b.createdAt);
      case 'az':     return (a.title || '').localeCompare(b.title || '');
      case 'za':     return (b.title || '').localeCompare(a.title || '');
      case 'newest':
      default:       return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  return out;
}

function updateActiveFiltersDisplay(filteredCount) {
  const totalEl = document.getElementById('totalProcessesCount');
  if (totalEl) totalEl.textContent = filteredCount;

  const af = document.getElementById('activeFilters');
  if (!af) return;

  const list = [];
  if (filterState.selectedTags.size > 0) list.push(`${filterState.selectedTags.size} tag(s)`);
  if (filterState.searchTerm) list.push(`busca: "${filterState.searchTerm}"`);
  if (filterState.selectedSession) {
    const s = AppData.getSessionById(filterState.selectedSession);
    if (s) list.push(`sessão: ${s.name}`);
  }

  if (list.length === 0) { af.style.display = 'none'; return; }
  af.style.display = 'inline-flex';
  af.innerHTML = `<i class="fas fa-filter"></i> ${list.join(' • ')}
    <i class="fas fa-times" id="clearActiveFilters" title="Limpar filtros"></i>`;
  af.querySelector('#clearActiveFilters').addEventListener('click', resetAllFilters);
}

window.resetAllFilters = function () {
  filterState.selectedTags.clear();
  filterState.searchTerm = '';
  filterState.selectedSession = '';
  filterState.currentPage = 1;
  if (elements.searchProcesses) elements.searchProcesses.value = '';
  if (elements.sessionSelect) elements.sessionSelect.value = '';
  renderTagsFilter();
  renderProcessesWithFilters();
};

// =====================================================
// RENDERIZAÇÃO DOS PROCESSOS (3 modos)
// =====================================================
function renderProcessesWithFilters() {
  const container = elements.processesContainer;
  if (!container) return;

  filterState.searchTerm = elements.searchProcesses ? elements.searchProcesses.value.trim() : '';
  filterState.selectedSession = elements.sessionSelect ? elements.sessionSelect.value : '';

  const filtered = applyFilters(AppData.processes);
  const total = filtered.length;

  updateActiveFiltersDisplay(total);

  // Limpa paginação (sem limite por página)
  if (elements.pagination) elements.pagination.innerHTML = '';

  // Aplicar classe de modo no container
  container.className = 'processes-container view-' + (UIPrefs.data.viewMode || 'cards');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-tasks fa-3x"></i>
        <h3>Nenhum processo encontrado</h3>
        <p>Tente ajustar os filtros ou cadastrar novos processos.</p>
      </div>`;
    return;
  }

  switch (UIPrefs.data.viewMode) {
    case 'list':  renderProcessListMode(filtered, container); break;
    case 'table': renderProcessTableMode(filtered, container); break;
    case 'cards':
    default:      renderProcessCardsMode(filtered, container);
  }

  attachProcessActionListeners();
}

function renderProcessCardsMode(processes, container) {
  container.innerHTML = '';
  processes.forEach(p => {
    const session = AppData.getSessionById(p.sessionId);
    const card = document.createElement('div');
    card.className = 'process-card';
    card.style.borderLeftColor = p.color;

    const tagsHtml = (p.tags || []).map(t => {
      const sel = filterState.selectedTags.has(t);
      return `<span class="tag ${sel ? 'filter-match' : ''}">${escapeHtml(t)}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="process-header">
        <div class="process-header-info">
          <div class="process-title">${escapeHtml(p.title)}</div>
          ${session ? `<span class="process-session" style="background:${session.color}22;color:${session.color}">${escapeHtml(session.name)}</span>` : ''}
        </div>
        <div class="process-quick-actions">
          <button class="icon-btn copy-process" data-id="${p.id}" title="Copiar processo">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="process-content">${escapeHtml(p.description).replace(/\n/g, '<br>')}</div>
      ${tagsHtml ? `<div class="process-tags">${tagsHtml}</div>` : ''}
      <div class="process-actions">
        <button class="btn-secondary btn-small edit-process" data-id="${p.id}">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn-danger btn-small delete-process" data-id="${p.id}">
          <i class="fas fa-trash"></i> Excluir
        </button>
      </div>`;
    container.appendChild(card);
  });
}

function renderProcessListMode(processes, container) {
  container.innerHTML = '';
  processes.forEach(p => {
    const session = AppData.getSessionById(p.sessionId);
    const row = document.createElement('div');
    row.className = 'process-row';
    row.style.borderLeftColor = p.color;
    const tagsHtml = (p.tags || []).slice(0, 4).map(t =>
      `<span class="tag-mini">${escapeHtml(t)}</span>`).join('');

    row.innerHTML = `
      <div class="process-row-main">
        <div class="process-row-title">${escapeHtml(p.title)}</div>
        <div class="process-row-meta">
          ${session ? `<span class="process-session-mini" style="background:${session.color}22;color:${session.color}">${escapeHtml(session.name)}</span>` : ''}
          ${tagsHtml}
        </div>
      </div>
      <div class="process-row-actions">
        <button class="icon-btn copy-process" data-id="${p.id}" title="Copiar"><i class="fas fa-copy"></i></button>
        <button class="icon-btn expand-process" data-id="${p.id}" title="Ver conteúdo"><i class="fas fa-eye"></i></button>
        <button class="icon-btn edit-process" data-id="${p.id}" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="icon-btn danger delete-process" data-id="${p.id}" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>`;
    container.appendChild(row);
  });
}

function renderProcessTableMode(processes, container) {
  container.innerHTML = `
    <table class="process-table">
      <thead>
        <tr>
          <th>Título</th>
          <th>Sessão</th>
          <th>Tags</th>
          <th>Criado em</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${processes.map(p => {
          const s = AppData.getSessionById(p.sessionId);
          const tagsHtml = (p.tags || []).slice(0, 3).map(t => `<span class="tag-mini">${escapeHtml(t)}</span>`).join('');
          const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '—';
          return `
            <tr style="border-left:4px solid ${p.color}">
              <td><strong>${escapeHtml(p.title)}</strong></td>
              <td>${s ? `<span class="process-session-mini" style="background:${s.color}22;color:${s.color}">${escapeHtml(s.name)}</span>` : '—'}</td>
              <td>${tagsHtml || '<span class="text-light">—</span>'}</td>
              <td><span class="text-light">${date}</span></td>
              <td>
                <button class="icon-btn copy-process" data-id="${p.id}" title="Copiar"><i class="fas fa-copy"></i></button>
                <button class="icon-btn expand-process" data-id="${p.id}" title="Ver conteúdo"><i class="fas fa-eye"></i></button>
                <button class="icon-btn edit-process" data-id="${p.id}" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="icon-btn danger delete-process" data-id="${p.id}" title="Excluir"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function attachProcessActionListeners() {
  document.querySelectorAll('.copy-process').forEach(b =>
    b.addEventListener('click', e => copyProcess(e.currentTarget.dataset.id)));
  document.querySelectorAll('.delete-process').forEach(b =>
    b.addEventListener('click', e => deleteProcess(e.currentTarget.dataset.id)));
  document.querySelectorAll('.edit-process').forEach(b =>
    b.addEventListener('click', e => editProcess(e.currentTarget.dataset.id)));
  document.querySelectorAll('.expand-process').forEach(b =>
    b.addEventListener('click', e => openProcessDetail(e.currentTarget.dataset.id)));
}

function openProcessDetail(id) {
  const p = AppData.processes.find(x => x.id === id);
  if (!p) return;
  const s = AppData.getSessionById(p.sessionId);
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('detailModalBody');
  if (!modal || !body) return;
  body.innerHTML = `
    <h3 style="border-left:4px solid ${p.color};padding-left:.75rem">${escapeHtml(p.title)}</h3>
    ${s ? `<p><span class="process-session-mini" style="background:${s.color}22;color:${s.color}">${escapeHtml(s.name)}</span></p>` : ''}
    <pre class="detail-content">${escapeHtml(p.description)}</pre>
    ${(p.tags || []).length ? `<div class="process-tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="modal-actions">
      <button class="btn-primary" onclick="copyProcess('${p.id}')"><i class="fas fa-copy"></i> Copiar</button>
      <button class="btn-secondary" id="closeDetailModal">Fechar</button>
    </div>`;
  modal.classList.add('active');
  document.getElementById('closeDetailModal').addEventListener('click', () => modal.classList.remove('active'));
}

// =====================================================
// PAGINAÇÃO
// =====================================================
function renderPagination(totalPages) {
  const el = elements.pagination;
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  html += `<button class="pagination-btn" ${filterState.currentPage === 1 ? 'disabled' : ''} data-page="${filterState.currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;

  const max = 5;
  let start = Math.max(1, filterState.currentPage - Math.floor(max / 2));
  let end = Math.min(totalPages, start + max - 1);
  if (end - start + 1 < max) start = Math.max(1, end - max + 1);

  if (start > 1) {
    html += `<button class="pagination-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span class="pagination-ellipsis">…</span>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="pagination-btn ${i === filterState.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="pagination-ellipsis">…</span>`;
    html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }
  html += `<button class="pagination-btn" ${filterState.currentPage === totalPages ? 'disabled' : ''} data-page="${filterState.currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;

  el.innerHTML = html;
  el.querySelectorAll('.pagination-btn').forEach(b => {
    b.addEventListener('click', () => {
      const page = parseInt(b.dataset.page, 10);
      if (!isNaN(page)) {
        filterState.currentPage = page;
        renderProcessesWithFilters();
        elements.processesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// =====================================================
// EXPORT / IMPORT
// =====================================================
function exportData(type = 'all') {
  let data, fileName;
  const today = new Date().toISOString().slice(0, 10);
  switch (type) {
    case 'sessions':
      data = { sessions: AppData.sessions };
      fileName = `sessoes-${today}.json`; break;
    case 'processes':
      data = { processes: AppData.processes };
      fileName = `processos-${today}.json`; break;
    default:
      data = { sessions: AppData.sessions, processes: AppData.processes, exportedAt: new Date().toISOString(), version: '2.0' };
      fileName = `backup-${today}.json`;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
  showNotification('Dados exportados!');
}

function importData() {
  const file = elements.importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      showConfirmModal('Importar dados',
        'Esta ação substituirá os dados atuais. Deseja continuar?',
        () => {
          if (imported.sessions)  AppData.sessions  = imported.sessions;
          if (imported.processes) AppData.processes = imported.processes;
          AppData.saveToLocalStorage();
          loadSessionSelects();
          renderSessions();
          renderTagsFilter();
          renderProcessesWithFilters();
          elements.importFile.value = '';
          elements.fileName.textContent = 'Nenhum arquivo selecionado';
          elements.importBtn.disabled = true;
          showNotification('Importado com sucesso!');
        });
    } catch (err) {
      showNotification('Arquivo inválido!', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

AppData.updateJsonPreview = function (type = 'all') {
  const el = document.getElementById('jsonPreview');
  if (!el) return;
  let data;
  switch (type) {
    case 'sessions':  data = { sessions: this.sessions }; break;
    case 'processes': data = { processes: this.processes }; break;
    default:          data = { sessions: this.sessions, processes: this.processes };
  }
  el.textContent = JSON.stringify(data, null, 2);
};

// =====================================================
// NAVEGAÇÃO
// =====================================================
function switchTab(targetId) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.target === targetId);
  });
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.toggle('active', s.id === targetId);
  });
}

// =====================================================
// EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  // Navegação
  elements.navBtns.forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.target)));

  // Sessões
  elements.addSessionBtn.addEventListener('click', () => {
    elements.sessionForm.style.display = 'block';
    elements.sessionName.focus();
  });
  elements.cancelSessionBtn.addEventListener('click', () => {
    elements.sessionForm.style.display = 'none';
    resetSessionForm();
  });
  elements.saveSessionBtn.addEventListener('click', saveSession);
  elements.sessionName.addEventListener('keypress', e => {
    if (e.key === 'Enter') saveSession();
  });

  // Processos
  elements.addProcessBtn.addEventListener('click', addProcess);
  if (elements.cancelEditBtn) {
    elements.cancelEditBtn.addEventListener('click', resetProcessForm);
  }

  // Filtros básicos
  elements.sessionSelect.addEventListener('change', () => {
    filterState.selectedSession = elements.sessionSelect.value;
    filterState.currentPage = 1;
    renderProcessesWithFilters();
  });
  elements.searchProcesses.addEventListener('input', debounce(() => {
    filterState.currentPage = 1;
    renderProcessesWithFilters();
  }, 250));
  elements.clearFiltersBtn.addEventListener('click', resetAllFilters);

  // Toggle filtros avançados
  const toggleBtn = document.getElementById('toggleFiltersBtn');
  const advanced = document.getElementById('advancedFilters');
  if (toggleBtn && advanced) {
    toggleBtn.addEventListener('click', () => {
      const open = advanced.style.display !== 'none';
      advanced.style.display = open ? 'none' : 'block';
      const icon = toggleBtn.querySelector('i.fa-chevron-down, i.fa-chevron-up');
      if (icon) icon.className = open ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    });
  }

  // Selecionar/limpar tags
  const selAll = document.getElementById('selectAllTagsBtn');
  if (selAll) selAll.addEventListener('click', () => {
    document.querySelectorAll('.tag-checkbox input').forEach(cb => {
      cb.checked = true;
      filterState.selectedTags.add(cb.value);
      cb.closest('.tag-checkbox').classList.add('selected');
    });
    renderProcessesWithFilters();
  });
  const clrAll = document.getElementById('clearAllTagsBtn');
  if (clrAll) clrAll.addEventListener('click', () => {
    document.querySelectorAll('.tag-checkbox input').forEach(cb => {
      cb.checked = false;
      filterState.selectedTags.delete(cb.value);
      cb.closest('.tag-checkbox').classList.remove('selected');
    });
    renderProcessesWithFilters();
  });

  // Ordenação e itens por página
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.value = filterState.sortBy;
    sortFilter.addEventListener('change', e => {
      filterState.sortBy = e.target.value;
      UIPrefs.set('sortBy', filterState.sortBy);
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
  }
  // Modos de visualização
  elements.viewModeBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.mode === UIPrefs.data.viewMode);
    b.addEventListener('click', () => {
      const mode = b.dataset.mode;
      UIPrefs.set('viewMode', mode);
      elements.viewModeBtns.forEach(x => x.classList.toggle('active', x === b));
      renderProcessesWithFilters();
    });
  });

  // Exportação
  elements.exportAllBtn.addEventListener('click', () => exportData('all'));
  elements.exportSessionsBtn.addEventListener('click', () => exportData('sessions'));
  elements.exportProcessesBtn.addEventListener('click', () => exportData('processes'));

  elements.chooseFileBtn.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) {
      elements.fileName.textContent = f.name;
      elements.importBtn.disabled = false;
    }
  });
  elements.importBtn.addEventListener('click', importData);

  elements.clearAllBtn.addEventListener('click', () => {
    showConfirmModal('Limpar TODOS os dados',
      'Apagar TODAS as sessões e processos? Esta ação não pode ser desfeita.',
      () => {
        AppData.sessions = [];
        AppData.processes = [];
        AppData.saveToLocalStorage();
        loadSessionSelects();
        renderSessions();
        renderTagsFilter();
        renderProcessesWithFilters();
        showNotification('Tudo apagado!');
      });
  });

  // JSON tabs
  elements.jsonTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.jsonTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      AppData.updateJsonPreview(tab.dataset.type);
    });
  });

  // Modal de confirmação
  elements.modalCancelBtn.addEventListener('click', () => {
    elements.confirmModal.classList.remove('active');
    modalCallback = null;
  });
  elements.modalConfirmBtn.addEventListener('click', () => {
    if (modalCallback) modalCallback();
    elements.confirmModal.classList.remove('active');
    modalCallback = null;
  });

  // Fechar modais com clique no fundo + ESC
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('active');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
    // Atalho Ctrl+K para focar busca
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      switchTab('processes-section');
      elements.searchProcesses.focus();
      elements.searchProcesses.select();
    }
  });

  // Botão "voltar ao topo"
  if (elements.backToTopBtn) {
    window.addEventListener('scroll', () => {
      elements.backToTopBtn.classList.toggle('visible', window.scrollY > 300);
    });
    elements.backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================
function init() {
  elements = getElements();

  // Aplica preferências salvas
  filterState.itemsPerPage = UIPrefs.data.itemsPerPage;
  filterState.sortBy = UIPrefs.data.sortBy;

  loadSessionSelects();
  renderSessions();
  renderTagsFilter();
  renderProcessesWithFilters();
  setupEventListeners();
  AppData.updateStats();
  AppData.updateJsonPreview();

  // Inicializa o contador
  Counter.init();
}

document.addEventListener('DOMContentLoaded', init);
