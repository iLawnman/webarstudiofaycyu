// js/calibration.js

export class CalibrationManager {
  constructor(ui) {
    this.ui = ui;
    this.isCalibrating = false;
    this.progress = 0;
    
    this.lastPosition = null;
    this.lastRotation = null;
    this.totalAngleCovered = 0;
    this.totalDistanceCovered = 0;
    this.onCompleteCallback = null;
    
    // Создаем UI синхронно
    this.createUIOverlay();
  }

  createUIOverlay() {
    let container = document.getElementById('ar-calibration-overlay');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ar-calibration-overlay';
      container.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        display: none; flex-direction: column; align-items: center; justify-content: center;
        z-index: 99999; pointer-events: none; color: #ffffff; text-align: center; padding: 20px;
        box-sizing: border-box; font-family: sans-serif;
      `;

      container.innerHTML = `
        <div style="width: 70px; height: 70px; margin-bottom: 15px;">
          <svg viewBox="0 0 100 100" class="phone-anim" style="width: 100%; height: 100%;">
            <rect x="25" y="15" width="50" height="70" rx="8" fill="none" stroke="#ffffff" stroke-width="4"/>
            <circle cx="50" cy="75" r="3" fill="#ffffff"/>
            <path d="M 10,50 Q 50,20 90,50" fill="none" stroke="#00aaff" stroke-width="4" stroke-dasharray="6,6"/>
          </svg>
        </div>
        <div id="calib-text" style="font-size: 14px; font-weight: 500; margin-bottom: 12px;">
          Поводите камерой из стороны в сторону...
        </div>
        <div style="width: 160px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
          <div id="calib-progress-bar" style="width: 0%; height: 100%; background: #00ff88;"></div>
        </div>
      `;
      document.body.appendChild(container);
    }

    if (!document.getElementById('calib-anim-style')) {
      const style = document.createElement('style');
      style.id = 'calib-anim-style';
      style.textContent = `
        @keyframes phoneScan {
          0% { transform: rotate(-12deg) translateX(-8px); }
          50% { transform: rotate(12deg) translateX(8px); }
          100% { transform: rotate(-12deg) translateX(-8px); }
        }
        .phone-anim { animation: phoneScan 2s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    this.container = container;
    this.progressBar = container.querySelector('#calib-progress-bar');
    this.textElement = container.querySelector('#calib-text');
  }

  start(onComplete) {
    this.isCalibrating = true;
    this.progress = 0;
    this.totalAngleCovered = 0;
    this.totalDistanceCovered = 0;
    this.lastPosition = null;
    this.lastRotation = null;
    this.onCompleteCallback = onComplete;
    
    if (this.progressBar) this.progressBar.style.width = '0%';
    if (this.container) this.container.style.display = 'flex';
  }

  update(frame, xrRefSpace) {
    if (!this.isCalibrating || !frame || !xrRefSpace) return;

    // Безопасное получение pose
    let pose = null;
    try {
      pose = frame.getViewerPose(xrRefSpace);
    } catch (e) {
      return;
    }

    if (!pose) return;

    if (pose.emulatedPosition) {
      if (this.textElement) this.textElement.textContent = 'Сканируем поверхность пола...';
      return;
    }

    const pos = pose.transform.position;
    const rot = pose.transform.orientation;

    if (this.lastPosition && this.lastRotation) {
      const dx = pos.x - this.lastPosition.x;
      const dy = pos.y - this.lastPosition.y;
      const dz = pos.z - this.lastPosition.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dRot = Math.abs(rot.y - this.lastRotation.y);

      if (dist > 0.001) this.totalDistanceCovered += dist;
      if (dRot > 0.001) this.totalAngleCovered += dRot;

      // Накопление прогресса
      const distProgress = Math.min(1, this.totalDistanceCovered / 0.3);
      const rotProgress = Math.min(1, this.totalAngleCovered / 0.25);

      this.progress = Math.floor(((distProgress + rotProgress) / 2) * 100);
      if (this.progressBar) this.progressBar.style.width = `${this.progress}%`;

      if (this.progress >= 100) {
        this.finish();
      }
    }

    this.lastPosition = { x: pos.x, y: pos.y, z: pos.z };
    this.lastRotation = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
  }

  finish() {
    if (!this.isCalibrating) return;
    this.isCalibrating = false;
    if (this.container) this.container.style.display = 'none';
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  cancel() {
    this.isCalibrating = false;
    if (this.container) this.container.style.display = 'none';
  }
}