// uimodule.js — управление интерфейсом, статусами, логами и Chrome-панелью

export class UIModule {
  constructor(settings) {
    this.cfg = settings;
    this.els = {};
    this.logEntries = [];
    this._logPanelVisible = false;
  }

  /** Инициализация: кэш DOM, навешивание событий, стартовый статус */
  init() {
    this._cacheElements();
    this._bindEvents();
    this.setStatus('searching');
    this._applyDebugState(this.cfg.ui.debugDefault);
    return this;
  }

  _cacheElements() {
    const s = this.cfg.dom.selectors;
    for (const [key, sel] of Object.entries(s)) {
      this.els[key] = document.querySelector(sel);
    }
  }

  _bindEvents() {
    // Переключатель рамок / debug UI
    if (this.els.debugToggle) {
      this.els.debugToggle.addEventListener('change', (e) => {
        this._applyDebugState(e.target.checked);
        this.log(`Debug UI: ${e.target.checked ? 'ON' : 'OFF'}`);
      });
    }

    // Скрытие/показ верхней панели chrome
    if (this.els.uiToggle) {
      this.els.uiToggle.addEventListener('click', () => this.toggleChrome());
    }

    // Лог-панель
    if (this.els.logEar) {
      this.els.logEar.addEventListener('click', () => this.toggleLogPanel());
    }
    if (this.els.logHideBtn) {
      this.els.logHideBtn.addEventListener('click', () => this.hideLogPanel());
    }
    if (this.els.logClearBtn) {
      this.els.logClearBtn.addEventListener('click', () => this.clearLog());
    }
  }

  /** Установить статус: 'searching' | 'found' | 'lost' */
  setStatus(stateKey) {
    const st = this.cfg.ui.status[stateKey];
    if (!st) return;
    if (this.els.statusText) this.els.statusText.textContent = st.text;
    if (this.els.statusLed) {
      this.els.statusLed.className = 'led ' + st.ledClass;
    }
    this._updateMarkerFrame(stateKey);
  }

  _updateMarkerFrame(stateKey) {
    const frame = this.els.markerFrame;
    if (!frame) return;
    frame.classList.remove('found', 'lost', 'searching');
    if (stateKey === 'found') frame.classList.add('found');
    else if (stateKey === 'lost') frame.classList.add('lost');
    else frame.classList.add('searching');
  }

  /** Включить/выключить debug-рамки (CSS-класс на body + стиль чипа) */
  _applyDebugState(enabled) {
    document.body.classList.toggle('show-arjs-debug', enabled);
    if (this.els.debugChip) {
      this.els.debugChip.classList.toggle('on', enabled);
    }
  }

  toggleChrome() {
    const chrome = this.els.chrome;
    if (!chrome) return;
    const hidden = chrome.classList.toggle('hidden');
    this.log(`Chrome UI: ${hidden ? 'hidden' : 'visible'}`);
  }

  showLoader() {
    if (this.els.loader) this.els.loader.classList.remove('hidden');
  }

  hideLoader() {
    if (this.els.loader) this.els.loader.classList.add('hidden');
  }

  toggleLogPanel() {
    this._logPanelVisible = !this._logPanelVisible;
    if (this.els.logPanel) {
      this.els.logPanel.classList.toggle('hidden', !this._logPanelVisible);
    }
  }

  hideLogPanel() {
    this._logPanelVisible = false;
    if (this.els.logPanel) this.els.logPanel.classList.add('hidden');
  }

  /** Добавить запись в лог с таймштампом */
  log(msg) {
    const entry = {
      time: new Date().toLocaleTimeString('ru-RU', { hour12: false }),
      text: String(msg)
    };
    this.logEntries.push(entry);
    if (this.logEntries.length > this.cfg.ui.logMaxEntries) {
      this.logEntries.shift();
    }
    this._renderLog();
  }

  clearLog() {
    this.logEntries = [];
    this._renderLog();
  }

  _renderLog() {
    const list = this.els.logList;
    if (!list) return;
    list.innerHTML = this.logEntries.map(e =>
      `<div class="log-entry"><span class="log-time">${e.time}</span> <span class="log-text">${this._escapeHtml(e.text)}</span></div>`
    ).join('');
    list.scrollTop = list.scrollHeight;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  setDiag(text) {
    if (this.els.diagStatus) this.els.diagStatus.textContent = text;
  }
}
