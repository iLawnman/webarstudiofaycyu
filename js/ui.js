export class UI {
  constructor() {
    this.btnCalibrate = document.getElementById('btn-calibrate');
    this.btnAr = document.getElementById('btn-ar');
    this.hint = document.getElementById('hint');
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');
    this.targetPreview = document.getElementById('target-preview');

    if (this.logToggle && this.logPanel) {
      this.logToggle.addEventListener('click', () => {
        this.logPanel.classList.toggle('collapsed');
      });
    }
  }

  // Восстановленный метод для превью таргета
  setPreview(src) {
    if (this.targetPreview) {
      this.targetPreview.src = src;
      this.targetPreview.style.display = 'block';
    }
  }

  enableCalibrateButton(handler) {
    if (!this.btnCalibrate) return;
    this.btnCalibrate.disabled = false;
    this.btnCalibrate.onclick = handler;
  }

  disableCalibrateButton() {
    if (this.btnCalibrate) this.btnCalibrate.disabled = true;
  }

  enableArButton(handler) {
    if (!this.btnAr) return;
    this.btnAr.disabled = false;
    this.btnAr.classList.add('success');
    if (handler) this.btnAr.onclick = handler;
  }

  disableArButton() {
    if (!this.btnAr) return;
    this.btnAr.disabled = true;
    this.btnAr.classList.remove('success');
  }

  setHint(text) {
    if (this.hint) this.hint.innerText = text;
  }

  log(msg, type = 'info') {
    if (!this.logPanel) return;
    const div = document.createElement('div');
    div.className = `entry ${type}`;
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logPanel.appendChild(div);
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
  }
}