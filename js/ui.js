export class UI {
  constructor() {
    this.logPanel = document.getElementById('log-panel');
    this.logToggle = document.getElementById('log-toggle');
    this.btnAr = document.getElementById('btn-ar');
    this.btnEndAr = document.getElementById('btn-end-ar');
    this.hint = document.getElementById('hint');
    this.preview = document.getElementById('target-preview');

    // curtain & quest-start
    this.curtain = document.getElementById('curtain-panel');
    this.curtainText = document.querySelector('.curtain-text');

    this.questStartPanel = document.getElementById('quest-start-panel');
    this.questStartImg = document.getElementById('quest-start-img');
    this.questStartText = document.getElementById('quest-start-text');

    this.resultPanel = document.getElementById('result-panel');
    this.resultSign = document.getElementById('result-sign');
    this.resultText = document.getElementById('result-text');
    this.resultCloseBtn = document.getElementById('result-close-btn');

    // Лог стартует свернутым
    this.logVisible = false;
    if (this.logPanel) this.logPanel.classList.add('collapsed');

    if (this.logToggle) {
      this.logToggle.addEventListener('click', () => {
        this.logVisible = !this.logVisible;
        this.logPanel.classList.toggle('collapsed', !this.logVisible);
      });
    }

    this._onQuestionSubmit = null;
    this._onResultClose = null;
    this.activeArTargetGroup = null;

    if (this.resultCloseBtn) {
      this.resultCloseBtn.addEventListener('click', () => {
        const cb = this._onResultClose;
        this.hideResult();
        if (cb) cb();
      });
    }
  }

  log(msg, type = '') {
    if (!this.logPanel) return;
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
    if (this.hint) this.hint.textContent = text;
  }

  setPreview(src) {
    if (!this.preview) return;
    this.preview.src = src;
    this.preview.style.display = 'block';
  }

  enableArButton() {
    if (!this.btnAr) return;
    this.btnAr.disabled = false;
    this.btnAr.style.display = 'block';
    if (this.curtainText) this.curtainText.classList.add('ready');
  }

  disableArButton() {
    if (!this.btnAr) return;
    this.btnAr.disabled = true;
    this.btnAr.style.display = 'none';
  }

  showEndArButton() {
    if (this.btnEndAr) this.btnEndAr.style.display = 'block';
  }

  hideEndArButton() {
    if (this.btnEndAr) this.btnEndAr.style.display = 'none';
  }

  onStartAR(handler) {
    if (this.btnAr) this.btnAr.addEventListener('click', handler);
  }

  onEndAR(handler) {
    if (this.btnEndAr) this.btnEndAr.addEventListener('click', handler);
  }

  // ───────────────────────── Curtain ─────────────────────────

  showCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.remove('hidden');
    if (this.curtainText) this.curtainText.classList.remove('ready');
  }

  hideCurtain() {
    if (!this.curtain) return;
    this.curtain.classList.add('hidden');
  }

  // ───────────────────────── Quest-start panel ─────────────────────────

  showQuestStart(imageSrc, text = 'ИЩИТЕ!') {
    if (!this.questStartPanel) return;
    if (this.questStartImg) {
      if (imageSrc) {
        this.questStartImg.src = imageSrc;
        this.questStartImg.style.display = 'block';
      } else {
        this.questStartImg.style.display = 'none';
      }
    }
    if (this.questStartText) this.questStartText.textContent = text;
    this.questStartPanel.classList.add('open');
  }

  hideQuestStart() {
    if (!this.questStartPanel) return;
    this.questStartPanel.classList.remove('open');
  }

  // ───────────────────────── Question panel (перенесена в ARTarget) ─────────────────────────

  setActiveArTarget(arTargetGroup) {
    this.activeArTargetGroup = arTargetGroup;
  }

  /**
   * Принимает данные вопроса и выводит их внутри 3D artarget вместо оверлея
   */
  showQuestion(data, onSubmit) {
    this._onQuestionSubmit = onSubmit || null;

    if (this.activeArTargetGroup && this.activeArTargetGroup.userData) {
      this.activeArTargetGroup.userData.questionData = data;
      this.activeArTargetGroup.visible = true;
    }
  }

  hideQuestion() {
    if (this.activeArTargetGroup) {
      this.activeArTargetGroup.visible = false;
    }
    this._onQuestionSubmit = null;
  }

  submitAnswer(value) {
    if (this._onQuestionSubmit) {
      const cb = this._onQuestionSubmit;
      this._onQuestionSubmit = null;
      cb(value);
    }
  }

  // ───────────────────────── Result panel ─────────────────────────

  showResult(isCorrect, text, onClose) {
    if (!this.resultPanel) return;
    this._onResultClose = onClose || null;
    this.resultPanel.classList.remove('result-ok', 'result-fail');
    this.resultPanel.classList.add(isCorrect ? 'result-ok' : 'result-fail');
    if (this.resultText) this.resultText.textContent = text || '';
    if (this.resultSign) this.resultSign.textContent = isCorrect ? '✓' : '✕';
    this.resultPanel.classList.add('open');
  }

  hideResult() {
    if (!this.resultPanel) return;
    this.resultPanel.classList.remove('open');
    this._onResultClose = null;
  }
}