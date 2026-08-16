// js/app.js

import { ARScene } from './ arscene.js';
import { CalibrationManager } from './calibration.js';

export class App {
  constructor() {
    this.ui = new UI(); // Инициализация UI из вашей структуры
    this.arScene = new ARScene(this.ui);
    this.calibration = new CalibrationManager(this.ui);

    this.xrSession = null;
    this.xrRefSpace = null;
    this.isSceneReady = false;

    this.init();
  }

  async init() {
    this.ui.log('App init (Native WebXR)...', 'info');
    this.ui.bindStartAr(() => this.startAR());
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('>>> Start AR clicked', 'info');

    if (!navigator.xr) {
      this.ui.setHint('WebXR не поддерживается');
      return;
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    if (!supported) {
      this.ui.setHint('immersive-ar не поддерживается');
      return;
    }

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      });
    } catch (e) {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor']
      });
    }

    // Привязка контекста WebGL к XR Session напрямую
    await this.arScene.gl.makeXRCompatible();
    
    this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.arScene.gl)
    });

    // Запрашиваем local-floor (физический уровень пола = 0)
    this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.xrSession = null;
      this.isSceneReady = false;
      this.ui.enableArButton();
    });

    // --- СТАРТ КАЛИБРОВКИ ДО ЗАПУСКА ОСНОВНОЙ СЦЕНЫ ---
    const success = await this.calibration.runCalibration(this.xrSession);
    if (success) {
      this.isSceneReady = true;
      this.ui.setHint('Сцена запущена. Пол на уровне Y = -1');
    }

    // Запуск анимационного цикла WebXR
    this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
  }

  onXRFrame(time, frame) {
    const session = frame.session;
    session.requestAnimationFrame((t, f) => this.onXRFrame(t, f));

    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    const gl = this.arScene.gl;
    const layer = session.renderState.baseLayer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Отрисовываем основную сцену только ПОСЛЕ успешной калибровки
    if (this.isSceneReady) {
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

        // Передаем матрицы проекции и вида в WebGL рендер
        this.arScene.renderView(view.projectionMatrix, view.transform.inverse.matrix);
      }
    }
  }
}

new App();