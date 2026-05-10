/* ===========================================================
 * theme.js
 * Toggle de tema (Sistema / Claro / Escuro) com persistência.
 *
 * Atributos no <html>:
 *   data-theme-pref  - preferência do usuário: system | light | dark
 *   data-theme       - tema resolvido aplicado pelo CSS: light | dark
 *
 * A hidratação inicial é feita por um <script> inline no <head>
 * de main.html, para evitar flash do tema errado.
 * =========================================================== */

const Theme = {
  KEY: 'theme',
  ORDER: ['system', 'light', 'dark'],
  STATES: {
    system: { icon: 'fa-desktop', label: 'Sistema', next: 'Claro' },
    light:  { icon: 'fa-sun',     label: 'Claro',   next: 'Escuro' },
    dark:   { icon: 'fa-moon',    label: 'Escuro',  next: 'Sistema' }
  },

  pref() {
    const v = localStorage.getItem(this.KEY);
    return this.STATES[v] ? v : 'system';
  },

  resolve(pref) {
    if (pref !== 'system') return pref;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  },

  apply(pref) {
    const resolved = this.resolve(pref);
    document.documentElement.setAttribute('data-theme-pref', pref);
    document.documentElement.setAttribute('data-theme', resolved);
    try { localStorage.setItem(this.KEY, pref); } catch (_) { /* storage indisponível */ }
  },

  cycle() {
    const cur = this.pref();
    const next = this.ORDER[(this.ORDER.indexOf(cur) + 1) % this.ORDER.length];
    this.apply(next);
    this._renderButton();
  },

  _renderButton() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const cur = this.pref();
    const meta = this.STATES[cur];
    btn.innerHTML = `<i class="fas ${meta.icon}"></i>`;
    btn.title = `Tema: ${meta.label} (clique para ${meta.next})`;
    btn.setAttribute('aria-label', `Alternar tema. Atual: ${meta.label}.`);
    btn.setAttribute('aria-pressed', cur !== 'system' ? 'true' : 'false');
  },

  init() {
    this._renderButton();
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => this.cycle());

    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (this.pref() === 'system') this.apply('system');
      };
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Theme.init());
