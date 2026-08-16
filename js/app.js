import { UI } from './ui.js';
import { ARScene } from './arscene.js';
import { CalibrationManager } from './calibration.js';
import { RecognitionManager } from './recognition.js';

export class App {
  constructor() {
    this.ui = new UI();
    this.arScene = null;
    this.calibration = null;
    this.recognition = null;

    this.xrSession = null;
    this.xrRefSpace = null;
    this.isCalibrated = false;
    this.isSceneReady = false;
    this.frameCount = 0;

    this.init();
  }

  async init() {
    try {
      this.ui.log('App init...', 'info');

      this.arScene = new ARScene(this.ui);
      this.calibration = new CalibrationManager(this.ui, this.arScene);
      this.recognition = new RecognitionManager(this.ui);

      if (!navigator.xr) {
        this.ui.setHint('WebXR не поддерживается');
        return;
      }

      const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
      if (!supported) {
        this.ui.setHint('Режим immersive-ar не поддерживается');
        return;
      }

      await this.recognition.initTarget('./assets/T1.jpg');

      this.ui.enableCalibrateButton(() => this.startCalibration());
      this.ui.setHint('Нажмите «Калибровка» для старта');
    } catch (err) {
      if (this.ui) this.ui.log('Init error: ' + err.message, 'err');
    }
  }

  async startCalibration() {
    this.ui.disableCalibrateButton();
    this.ui.log('>>> Запуск калибровки', 'info');

    try {
      const sessionInit = {
        requiredFeatures: ['hit-test', 'local-floor'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      };

      this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
      await this.arScene.gl.makeXRCompatible();

      this.xrSession.updateRenderState({
        baseLayer: new XRWebGLLayer(this.xrSession, this.arScene.gl)
      });

      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');

      this.xrSession.addEventListener('end', () => {
        this.ui.log('Сессия WebXR завершена', 'warn');
        this.resetState();
      });

      // Запускаем главный рендер-цикл
      this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

      // Запускаем обработку калибровки
      const floorMatrix = await this.calibration.startCalibration(this.xrSession, this.xrRefSpace);

      if (floorMatrix) {
        this.isCalibrated = true;
        this.arScene.setFloor(floorMatrix);
        
        this.ui.log('Уровень пола зафиксирован', 'ok');
        this.ui.setHint('Пол установлен! Нажмите «Запустить AR»');
        this.ui.enableArButton(() => this.startARScene());
      }

    } catch (err) {
      this.ui.log('Ошибка калибровки: ' + err.message, 'err');
      this.ui.enableCalibrateButton(() => this.startCalibration());
    }
  }

  startARScene() {
    this.ui.disableArButton();
    this.isSceneReady = true;
    this.ui.setHint('AR Сцена активна. Ищите маркер.');
    this.ui.log('Основной режим AR включен', 'ok');
  }

  onXRFrame(time, frame) {
    if (!this.xrSession) return;

    this.xrSession.requestAnimationFrame((t, f) => this.onXRFrame(t, f));
    this.frameCount++;

    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    // 1. Обновление калибровки (хитрейст кружка)
    if (this.calibration.isCalibrating) {
      this.calibration.update(frame, this.xrRefSpace);
    }

    // 2. Распознавание и постройка при активной сцене
    if (this.isSceneReady) {
      this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      this.arScene.updateAnimation(time);
    }

    // 3. Отрисовка кадра WebGL
    const gl = this.arScene.gl;
    const layer = this.xrSession.renderState.baseLayer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const view of pose.views) {
      const viewport = layer.getViewport(view);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      this.arScene.renderView(view.projectionMatrix, view.transform.inverse.matrix);
    }
  }

  resetState() {
    this.xrSession = null;
    this.isSceneReady = false;
    this.isCalibrated = false;
    this.ui.enableCalibrateButton(() => this.startCalibration());
    this.ui.setHint('Сессия завершена. Нажмите Калибровка.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});