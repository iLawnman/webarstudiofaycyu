// js/ui.js

export class UI {
  constructor() {
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');
    this.btnAr = document.getElementById('btn-ar');
    this.hint = document.getElementById('hint');
    this.preview = document.getElementById('target-preview');

    this.logVisible = true;

    this.logToggle.addEventListener('click', () => {
      this.logVisible = !this.logVisible;
      this.logPanel.classList.toggle('collapsed', !this.logVisible);
    });
  }

  log(msg, type = '') {
    const div = document.createElement('div');
    div.className = 'entry ' + type;
    const now = new Date();
    const t = now.toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    div.textContent = `[${t}] ${msg}`;
    this.logPanel.appendChild(div);
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
    console.log(`[${type || 'log'}] ${msg}`);
  }

  setHint(text) {
    this.hint.textContent = text;
  }

  setPreview(src) {
    this.preview.src = src;
    this.preview.style.display = 'block';
  }

  enableArButton() {
    this.btnAr.disabled = false;
  }

  disableArButton() {
    this.btnAr.disabled = true;
  }

  onStartAR(handler) {
    this.btnAr.addEventListener('click', handler);
  }
}