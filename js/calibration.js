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
    this.createUIOverlay();
  }

  createUIOverlay() {
    if (document.getElementById('ar-calibration-overlay')) return;

    this.container = document.createElement('div');
    this.container.id = 'ar-calibration-overlay';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      z-index: 9999; pointer-events: none; color: #ffffff; text-align: center; padding: 20px;
      box-sizing: border-box;
    `;

    this.container.innerHTML = `
      <div style="width: 80px; height: 80px; margin-bottom: 20px;">
        <svg viewBox="0 0 100 100" class="phone-anim" style="width: 100%; height: 100%;">
          <rect x="25" y="15" width="50" height="70" rx="8" fill="none" stroke="#ffffff" stroke-width="4"/>
          <circle cx="50" cy="75" r="3" fill="#ffffff"/>
          <path d="M 10,50 Q 50,20 90,50" fill="none" stroke="#00aaff" stroke-width="4" stroke-dasharray="6,6"/>
        </svg>
      </div>
      <div id="calib-text" style="font-size: 15px; font-weight: 500; margin-bottom: 15px;">
        Медленно поводите телефоном для сканирования пола
      </div>
      <div style="width: 180px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
        <div id="calib-progress-bar" style="width: 0%; height: 100%; background: #00ff88; transition: width 0.1s linear;"></div>
      </div>
    `;

    if (!document.getElementById('calib-anim-style')) {
      const style = document.createElement('style');
      style.id = 'calib-anim-style';
      style.textContent = `
        @keyframes phoneScan {
          0% { transform: rotate(-15deg) translateX(-10px); }
          50% { transform: rotate(15deg) translateX(10px); }
          100% { transform: rotate(-15deg) translateX(-10px); }
        }
        .phone-anim { animation: phoneScan 2s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(this.container);

    this.progressBar = this.container.querySelector('#calib-progress-bar');
    this.textElement = this.container.querySelector('#calib-text');
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

    const pose = frame.getViewerPose(xrRefSpace);
    if (!pose) return;

    // Быстрый выход, если позиция все еще эмулируется системой
    if (pose.emulatedPosition) {
      if (this.textElement) this.textElement.textContent = 'Поведите камерой над полом...';
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

      if (dist > 0.002) this.totalDistanceCovered += dist;
      if (dRot > 0.002) this.totalAngleCovered += dRot;

      // Ускоренный набор прогресса калибровки для защиты от зависаний
      const distProgress = Math.min(1, this.totalDistanceCovered / 0.4);
      const rotProgress = Math.min(1, this.totalAngleCovered / 0.3);

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
    if (this.onCompleteCallback) this.onCompleteCallback();
  }

  cancel() {
    this.isCalibrating = false;
    if (this.container) this.container.style.display = 'none';
  }
}