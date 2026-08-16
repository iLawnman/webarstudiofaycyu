export class UI {
  constructor() {
    this.btnCalibrate = document.getElementById('btn-calibrate');
    this.btnAr = document.getElementById('btn-ar');
    this.hint = document.getElementById('hint');
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');

    this.logToggle.addEventListener('click', () => {
      this.logPanel.classList.toggle('collapsed');
    });
  }

  enableCalibrateButton(handler) {
    this.btnCalibrate.disabled = false;
    this.btnCalibrate.onclick = handler;
  }

  disableCalibrateButton() {
    this.btnCalibrate.disabled = true;
  }

  enableArButton(handler) {
    this.btnAr.disabled = false;
    this.btnAr.classList.add('success');
    this.btnAr.onclick = handler;
  }

  disableArButton() {
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