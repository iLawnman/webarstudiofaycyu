export class CalibrationManager {
  constructor(ui) {
    this.ui = ui;
    this.isCalibrating = false;
    this.progress = 0;
    
    // Переменные для отслеживания движения
    this.lastPosition = null;
    this.lastRotation = null;
    this.totalAngleCovered = 0;
    this.totalDistanceCovered = 0;
    
    this.onCompleteCallback = null;
    this.createUIOverlay();
  }

  createUIOverlay() {
    this.container = document.createElement('div');
    this.container.id = 'ar-calibration-overlay';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(4px);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      z-index: 200; pointer-events: none; color: white; text-align: center; padding: 20px;
    `;

    this.container.innerHTML = `
      <div style="width: 120px; height: 120px; margin-bottom: 24px; position: relative;">
        <svg viewBox="0 0 100 100" class="phone-anim" style="width: 100%; height: 100%;">
          <path d="M 30,20 L 70,20 A 8,8 0 0 1 78,28 L 78,72 A 8,8 0 0 1 70,80 L 30,80 A 8,8 0 0 1 22,72 L 22,28 A 8,8 0 0 1 30,20 Z" 
                fill="none" stroke="#ffffff" stroke-width="4" />
          <circle cx="50" cy="74" r="3" fill="#ffffff" />
          <path d="M 10,50 Q 50,20 90,50" fill="none" stroke="#00aaff" stroke-width="4" stroke-linecap="round" stroke-dasharray="6,6" />
        </svg>
      </div>
      <div id="calib-text" style="font-size: 16px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
        Медленно поводите телефоном из стороны в сторону и вниз к полу
      </div>
      <div style="width: 200px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; margin-top: 20px; overflow: hidden;">
        <div id="calib-progress-bar" style="width: 0%; height: 100%; background: #00ff88; transition: width 0.2s ease;"></div>
      </div>
    `;

    // Анимация качающегося телефона (WebAR standard onboarding animation)
    const style = document.createElement('style');
    style.textContent = `
      @keyframes phoneScan {
        0% { transform: rotate(-18deg) translateX(-15px); }
        50% { transform: rotate(18deg) translateX(15px); }
        100% { transform: rotate(-18deg) translateX(-15px); }
      }
      .phone-anim {
        animation: phoneScan 2.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
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
    
    this.progressBar.style.width = '0%';
    this.container.style.display = 'flex';
    this.ui.log('Calibration sequence started', 'info');
  }

  update(frame, xrRefSpace) {
    if (!this.isCalibrating || !frame || !xrRefSpace) return;

    const pose = frame.getViewerPose(xrRefSpace);
    if (!pose) return;

    // Определение того, что система ещё не определила реальные физические размеры
    if (pose.emulatedPosition) {
      this.textElement.textContent = 'Наведите камеру на текстурированную поверхность пола...';
      return;
    } else {
      this.textElement.textContent = 'Медленно поводите телефоном из стороны в сторону и вниз к полу';
    }

    const pos = pose.transform.position;
    const rot = pose.transform.orientation;

    if (this.lastPosition && this.lastRotation) {
      // 1. Оценка пройденного дистационного расстояния
      const dx = pos.x - this.lastPosition.x;
      const dy = pos.y - this.lastPosition.y;
      const dz = pos.z - this.lastPosition.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // 2. Оценка изменения угла (простейшее скалярное приближение по Yaw)
      const dRot = Math.abs(rot.y - this.lastRotation.y);

      if (dist > 0.005) this.totalDistanceCovered += dist;
      if (dRot > 0.005) this.totalAngleCovered += dRot;

      // Рассчитываем прогресс (нужно накопить базовое движение кадра и вращение)
      const distProgress = Math.min(1, this.totalDistanceCovered / 0.8); // 80 см суммарного движения
      const rotProgress = Math.min(1, this.totalAngleCovered / 0.6);   // ~35 градусов панорамы

      this.progress = Math.floor(((distProgress + rotProgress) / 2) * 100);
      this.progressBar.style.width = `${this.progress}%`;

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
    this.container.style.display = 'none';
    this.ui.log('Calibration finished successfully!', 'ok');
    
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  cancel() {
    this.isCalibrating = false;
    this.container.style.display = 'none';
  }
}