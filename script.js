// ===========================================
// NOVAS FUNÇÕES PARA FILTRO POR TAGS
// Adicione estas funções ao seu script.js existente
// ===========================================

// Estado dos filtros
const filterState = {
  selectedTags: new Set(),
  sortBy: 'newest',
  itemsPerPage: 20,
  currentPage: 1,
  searchTerm: '',
  selectedSession: ''
};

// Extrair todas as tags únicas dos processos
function getAllUniqueTags() {
  const tagsSet = new Set();
  
  AppData.processes.forEach(process => {
    if (process.tags && Array.isArray(process.tags)) {
      process.tags.forEach(tag => tagsSet.add(tag));
    }
  });
  
  return Array.from(tagsSet).sort();
}

// Renderizar filtro de tags
function renderTagsFilter() {
  const container = document.getElementById('tagsFilterContainer');
  if (!container) return;
  
  const allTags = getAllUniqueTags();
  
  if (allTags.length === 0) {
    container.innerHTML = '<p class="text-light">Nenhuma tag disponível</p>';
    return;
  }
  
  container.innerHTML = '';
  
  allTags.forEach(tag => {
    const label = document.createElement('label');
    label.className = `tag-checkbox ${filterState.selectedTags.has(tag) ? 'selected' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = tag;
    checkbox.checked = filterState.selectedTags.has(tag);
    
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        filterState.selectedTags.add(tag);
      } else {
        filterState.selectedTags.delete(tag);
      }
      label.classList.toggle('selected', e.target.checked);
      updateActiveFiltersDisplay();
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${tag}`));
    container.appendChild(label);
  });
}

// Aplicar todos os filtros aos processos
function applyFilters(processes) {
  let filtered = [...processes];
  
  // Filtro por sessão
  if (filterState.selectedSession) {
    filtered = filtered.filter(p => p.sessionId === filterState.selectedSession);
  }
  
  // Filtro por busca
  if (filterState.searchTerm) {
    const term = filterState.searchTerm.toLowerCase();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(term)))
    );
  }
  
  // Filtro por tags selecionadas
  if (filterState.selectedTags.size > 0) {
    filtered = filtered.filter(p => {
      if (!p.tags || p.tags.length === 0) return false;
      return Array.from(filterState.selectedTags).every(tag => 
        p.tags.includes(tag)
      );
    });
  }
  
  // Ordenação
  filtered.sort((a, b) => {
    switch(filterState.sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'az':
        return a.title.localeCompare(b.title);
      case 'za':
        return b.title.localeCompare(a.title);
      default:
        return 0;
    }
  });
  
  return filtered;
}

// Renderizar processos com paginação
function renderProcessesWithFilters() {
  const container = elements.processesContainer;
  if (!container) return;
  
  // Atualizar estado dos filtros
  filterState.searchTerm = elements.searchProcesses ? elements.searchProcesses.value.toLowerCase() : '';
  filterState.selectedSession = elements.sessionSelect ? elements.sessionSelect.value : '';
  
  // Aplicar filtros
  const filteredProcesses = applyFilters(AppData.processes);
  const totalProcesses = filteredProcesses.length;
  
  // Calcular paginação
  const totalPages = Math.ceil(totalProcesses / filterState.itemsPerPage);
  filterState.currentPage = Math.min(filterState.currentPage, totalPages) || 1;
  
  const start = (filterState.currentPage - 1) * filterState.itemsPerPage;
  const end = start + filterState.itemsPerPage;
  const paginatedProcesses = filteredProcesses.slice(start, end);
  
  // Atualizar estatísticas
  updateFilterStats(totalProcesses, filteredProcesses.length);
  
  // Renderizar processos
  renderProcessCards(paginatedProcesses);
  
  // Renderizar paginação
  renderPagination(totalPages);
}

// Renderizar cards de processos
function renderProcessCards(processes) {
  const container = elements.processesContainer;
  container.innerHTML = '';
  
  if (processes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-tasks fa-3x" style="color: #d1d5db; margin-bottom: 1rem;"></i>
        <h3>Nenhum processo encontrado</h3>
        <p>Tente ajustar seus filtros ou adicionar novos processos.</p>
      </div>
    `;
    return;
  }
  
  processes.forEach(process => {
    const session = AppData.getSessionById(process.sessionId);
    
    const processCard = document.createElement('div');
    processCard.className = 'process-card';
    processCard.style.borderLeftColor = process.color;
    
    // Destacar tags que estão sendo filtradas
    const highlightedTags = process.tags ? process.tags.map(tag => {
      const isSelected = filterState.selectedTags.has(tag);
      return `<span class="tag ${isSelected ? 'filter-match' : ''}">${tag}</span>`;
    }).join('') : '';
    
    processCard.innerHTML = `
      <div class="process-header">
        <div>
          <div class="process-title">${process.title}</div>
          ${session ? `<span class="process-session">${session.name}</span>` : ''}
        </div>
        <div class="process-actions">
          <button class="btn-secondary copy-process" data-id="${process.id}">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-danger delete-process" data-id="${process.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="process-content">${process.description}</div>
      ${process.tags && process.tags.length > 0 ? `
        <div class="process-tags">
          ${highlightedTags}
        </div>
      ` : ''}
      <div class="process-actions">
        <button class="btn-secondary edit-process" data-id="${process.id}">
          <i class="fas fa-edit"></i> Editar
        </button>
      </div>
    `;
    
    container.appendChild(processCard);
  });
  
  // Adicionar event listeners
  document.querySelectorAll('.copy-process').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const processId = e.target.closest('button').dataset.id;
      copyProcess(processId);
    });
  });
  
  document.querySelectorAll('.delete-process').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const processId = e.target.closest('button').dataset.id;
      deleteProcess(processId);
    });
  });
  
  document.querySelectorAll('.edit-process').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const processId = e.target.closest('button').dataset.id;
      editProcess(processId);
    });
  });
}

// Renderizar paginação
function renderPagination(totalPages) {
  const paginationEl = document.getElementById('pagination');
  if (!paginationEl) return;
  
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // Botão anterior
  html += `<button class="pagination-btn" ${filterState.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${filterState.currentPage - 1})">
    <i class="fas fa-chevron-left"></i>
  </button>`;
  
  // Números das páginas
  const maxVisible = 5;
  let startPage = Math.max(1, filterState.currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === filterState.currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
    html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
  }
  
  // Botão próximo
  html += `<button class="pagination-btn" ${filterState.currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${filterState.currentPage + 1})">
    <i class="fas fa-chevron-right"></i>
  </button>`;
  
  paginationEl.innerHTML = html;
}

// Mudar página
window.changePage = function(page) {
  filterState.currentPage = page;
  renderProcessesWithFilters();
};

// Atualizar estatísticas dos filtros
function updateFilterStats(total, filtered) {
  const statsEl = document.getElementById('filterStats');
  const totalEl = document.getElementById('totalProcessesCount');
  const activeFiltersEl = document.getElementById('activeFilters');
  
  if (totalEl) totalEl.textContent = filtered;
  
  // Mostrar filtros ativos
  const activeFilters = [];
  if (filterState.selectedTags.size > 0) {
    activeFilters.push(`${filterState.selectedTags.size} tag(s)`);
  }
  if (filterState.searchTerm) {
    activeFilters.push(`busca: "${filterState.searchTerm}"`);
  }
  if (filterState.selectedSession) {
    const session = AppData.getSessionById(filterState.selectedSession);
    if (session) activeFilters.push(`sessão: ${session.name}`);
  }
  
  if (activeFilters.length > 0 && activeFiltersEl) {
    activeFiltersEl.style.display = 'inline-flex';
    activeFiltersEl.innerHTML = `
      <i class="fas fa-filter"></i>
      ${activeFilters.join(' • ')}
      <i class="fas fa-times" onclick="resetAllFilters()" style="cursor: pointer;"></i>
    `;
  } else if (activeFiltersEl) {
    activeFiltersEl.style.display = 'none';
  }
}

// Resetar todos os filtros
window.resetAllFilters = function() {
  filterState.selectedTags.clear();
  filterState.searchTerm = '';
  filterState.selectedSession = '';
  filterState.sortBy = 'newest';
  filterState.currentPage = 1;
  
  if (elements.searchProcesses) elements.searchProcesses.value = '';
  if (elements.sessionSelect) elements.sessionSelect.value = '';
  
  // Resetar checkboxes das tags
  document.querySelectorAll('.tag-checkbox input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.tag-checkbox')?.classList.remove('selected');
  });
  
  renderProcessesWithFilters();
  renderTagsFilter();
};

// Configurar event listeners dos filtros
function setupFilterListeners() {
  // Botão toggle filters
  const toggleBtn = document.getElementById('toggleFiltersBtn');
  const advancedFilters = document.getElementById('advancedFilters');
  
  if (toggleBtn && advancedFilters) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = advancedFilters.style.display === 'none';
      advancedFilters.style.display = isHidden ? 'block' : 'none';
      toggleBtn.innerHTML = isHidden ? 
        '<i class="fas fa-chevron-up"></i> Recolher' : 
        '<i class="fas fa-chevron-down"></i> Expandir';
    });
  }
  
  // Botões de seleção de tags
  const selectAllBtn = document.getElementById('selectAllTagsBtn');
  const clearAllBtn = document.getElementById('clearAllTagsBtn');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.tag-checkbox input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        filterState.selectedTags.add(cb.value);
        cb.closest('.tag-checkbox')?.classList.add('selected');
      });
      updateActiveFiltersDisplay();
    });
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.tag-checkbox input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        filterState.selectedTags.delete(cb.value);
        cb.closest('.tag-checkbox')?.classList.remove('selected');
      });
      updateActiveFiltersDisplay();
    });
  }
  
  // Filtros de ordenação
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      filterState.sortBy = e.target.value;
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
  }
  
  // Itens por página
  const itemsPerPage = document.getElementById('itemsPerPage');
  if (itemsPerPage) {
    itemsPerPage.addEventListener('change', (e) => {
      filterState.itemsPerPage = parseInt(e.target.value);
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
  }
  
  // Botão aplicar filtros
  const applyBtn = document.getElementById('applyFiltersBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
  }
  
  // Botão resetar filtros
  const resetBtn = document.getElementById('resetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllFilters);
  }
  
  // Atualizar quando mudar a busca ou sessão
  if (elements.searchProcesses) {
    elements.searchProcesses.addEventListener('input', debounce(() => {
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    }, 300));
  }
  
  if (elements.sessionSelect) {
    elements.sessionSelect.addEventListener('change', () => {
      filterState.currentPage = 1;
      renderProcessesWithFilters();
    });
  }
}

// Sobrescrever a função renderProcesses original
const originalRenderProcesses = renderProcesses;
renderProcesses = function() {
  renderTagsFilter();
  renderProcessesWithFilters();
};

// Adicionar chamada aos filtros na inicialização
const originalInit = init;
init = function() {
  originalInit();
  setupFilterListeners();
  renderTagsFilter();
};

// Atualizar quando novos processos forem adicionados
const originalAddProcess = addProcess;
addProcess = function() {
  originalAddProcess();
  renderTagsFilter();
  renderProcessesWithFilters();
};

// Atualizar quando processos forem deletados
const originalDeleteProcess = deleteProcess;
deleteProcess = function(processId) {
  originalDeleteProcess(processId);
  renderTagsFilter();
  renderProcessesWithFilters();
};