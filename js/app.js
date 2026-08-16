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
        this.ui.log('navigator.xr missing', 'err');
        return;
      }

      const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
      if (!supported) {
        this.ui.setHint('Режим immersive-ar не поддерживается');
        this.ui.log('immersive-ar not supported', 'warn');
        return;
      }

      // Загрузка ImageTarget из папки /assets/T1.jpg
      await this.recognition.initTarget('./assets/T1.jpg');

      this.ui.enableCalibrateButton(() => this.startCalibration());
      this.ui.setHint('Нажмите «Калибровка» для определения уровня пола');
    } catch (err) {
      console.error(err);
      if (this.ui) this.ui.log('Init error: ' + err.message, 'err');
    }
  }

  // --- ШАГ 1: Калибровка пола ---
  async startCalibration() {
    this.ui.disableCalibrateButton();
    this.ui.log('>>> Старт калибровки пола', 'info');

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
        this.ui.log('Калибровочная сессия завершена', 'warn');
        this.resetState();
      });

      // Запуск процесса калибровки в CalibrationManager
      const floorMatrix = await this.calibration.runCalibration(this.xrSession, this.xrRefSpace);

      if (floorMatrix) {
        this.isCalibrated = true;
        
        // Передаем зафиксированную матрицу пола в ARScene
        this.arScene.setFloor(floorMatrix);
        
        this.ui.log('Уровень пола зафиксирован и передан в ARScene', 'ok');
        this.ui.setHint('Пол откалиброван. Нажмите «Запустить AR»');
        this.ui.enableArButton(() => this.startARScene());
      } else {
        this.ui.setHint('Калибровка отменена');
        this.ui.enableCalibrateButton(() => this.startCalibration());
      }

    } catch (err) {
      this.ui.log('Ошибка калибровки: ' + err.message, 'err');
      this.ui.setHint('Ошибка калибровки: ' + err.message);
      this.ui.enableCalibrateButton(() => this.startCalibration());
    }
  }

  // --- ШАГ 2: Основная сцена + Распознавание ---
  async startARScene() {
    this.ui.disableArButton();
    this.ui.log('>>> Старт основной AR сцены с распознаванием', 'info');

    try {
      // Если предыдущая сессия закончилась — запрашиваем новую с поддержкой trackedImages
      if (!this.xrSession) {
        const sessionInit = {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body }
        };

        if (this.recognition.targetBitmap) {
          sessionInit.trackedImages = [{
            image: this.recognition.targetBitmap,
            widthInMeters: 0.2
          }];
        }

        this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
        await this.arScene.gl.makeXRCompatible();
        this.xrSession.updateRenderState({
          baseLayer: new XRWebGLLayer(this.xrSession, this.arScene.gl)
        });
        this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');
      }

      // Активируем визуальную постройку сцены на откалиброванном полу
      this.arScene.startConstructionAnimation();
      
      this.isSceneReady = true;
      this.ui.setHint('Сцена активна на уровне пола. Наведите камеру на маркер.');
      this.ui.log('Основная сцена и трекинг активны', 'ok');

      this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

    } catch (err) {
      this.ui.log('Ошибка запуска AR сцены: ' + err.message, 'err');
      this.ui.setHint('Ошибка запуска: ' + err.message);
    }
  }

  onXRFrame(time, frame) {
    if (!this.xrSession) return;

    this.xrSession.requestAnimationFrame((t, f) => this.onXRFrame(t, f));
    this.frameCount++;

    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    // Распознавание маркера и обновление анкоров
    if (this.isSceneReady) {
      this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      this.recognition.updateAnchors(frame, this.xrRefSpace);
      this.arScene.updateAnimation(time);
    }

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
    this.ui.setHint('Сессия завершена. Выполните калибровку.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});