// js/app.js
import * as THREE from 'three';
import { UI } from './ui.js';
import { ARScene } from './arscene.js';
import { CalibrationManager } from './calibration.js';

export class App {
  constructor() {
    this.ui = new UI();
    this.arScene = new ARScene(this.ui);
    this.calibration = new CalibrationManager(this.ui);

    this.xrSession = null;
    this.isArActive = false;

    // Включаем XR и задаем тип пространства заранее
    this.arScene.renderer.xr.enabled = true;
    this.arScene.renderer.xr.setReferenceSpaceType('local-floor');

    this.init();
  }

  init() {
    this.ui.log('App ready. Tap Start AR.', 'ok');
    
    // Назначаем клик
    if (this.ui.btnStartAr) {
      this.ui.btnStartAr.addEventListener('click', () => this.startAR());
    }

    window.addEventListener('resize', () => this.arScene.onWindowResize());

    // Единый главный цикл Three.js
    this.arScene.renderer.setAnimationLoop((time, frame) => this.onFrame(time, frame));
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('Starting AR Session...', 'info');

    if (!navigator.xr) {
      this.ui.log('WebXR not supported', 'err');
      this.ui.setHint('WebXR не поддерживается на вашем устройстве');
      return;
    }

    try {
      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!isSupported) {
        this.ui.log('immersive-ar not supported', 'err');
        this.ui.setHint('Режим immersive-ar недоступен');
        this.ui.enableArButton();
        return;
      }
    } catch (e) {
      this.ui.log('Check support error: ' + e.message, 'err');
    }

    // Базовый минимальный набор фич без блокирующих опций
    const sessionInit = {
      requiredFeatures: ['local-floor']
    };

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
      this.ui.log('Session acquired', 'ok');
    } catch (e) {
      this.ui.log('requestSession error: ' + e.message, 'err');
      this.ui.setHint('Не удалось открыть AR сессию: ' + e.message);
      this.ui.enableArButton();
      return;
    }

    // Событие завершения сессии
    this.xrSession.addEventListener('end', () => {
      this.ui.log('AR Session ended', 'warn');
      this.isArActive = false;
      this.xrSession = null;
      this.calibration.cancel();
      this.ui.enableArButton();
    });

    // Передаем сессию Three.js (Three.js сам синхронно настроит reference space 'local-floor')
    try {
      await this.arScene.renderer.xr.setSession(this.xrSession);
      this.isArActive = true;
      this.ui.log('Three.js XR session active', 'ok');
    } catch (e) {
      this.ui.log('setSession error: ' + e.message, 'err');
      this.ui.enableArButton();
      return;
    }

    // Запускаем калибровку
    this.calibration.start(() => {
      this.ui.log('Calibration complete! Floor locked.', 'ok');
      this.ui.setHint('Пол зафиксирован. AR активен.');
    });
  }

  onFrame(time, frame) {
    // 1. Если идет AR-сессия и мы в процессе калибровки
    if (this.isArActive && frame && this.calibration.isCalibrating) {
      // Получаем referenceSpace, который Three.js создал автоматически
      const refSpace = this.arScene.renderer.xr.getReferenceSpace();
      if (refSpace) {
        this.calibration.update(frame, refSpace);
      }
    }

    // 2. Рендеринг сцены на каждом кадре
    this.arScene.render();
  }
}

// Старт приложения при загрузке скрипта
window.addEventListener('DOMContentLoaded', () => {
  new App();
});