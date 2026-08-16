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
    this.isSceneReady = false;
    this.frameCount = 0;

    this.init();
  }

  async init() {
    try {
      this.ui.log('App init (Native WebXR)...', 'info');

      this.arScene = new ARScene(this.ui);
      this.calibration = new CalibrationManager(this.ui);
      this.recognition = new RecognitionManager(this.ui);

      if (!navigator.xr) {
        this.ui.setHint('WebXR не поддерживается в этом браузере');
        this.ui.log('navigator.xr missing', 'err');
        return;
      }

      const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
      if (!supported) {
        this.ui.setHint('Режим immersive-ar не поддерживается');
        this.ui.log('immersive-ar not supported', 'warn');
        return;
      }

      // Загрузка таргета
      await this.recognition.initTarget('./target.jpg');

      this.ui.onStartAR(() => this.startAR());
    } catch (err) {
      console.error(err);
      if (this.ui) this.ui.log('Init error: ' + err.message, 'err');
    }
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('>>> Start AR clicked', 'info');

    try {
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
        this.ui.log('Added trackedImages to requestSession', 'ok');
      }

      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
      } catch (e) {
        this.ui.log('Fallback: requestSession without dom-overlay...', 'warn');
        delete sessionInit.optionalFeatures;
        this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
      }

      await this.arScene.gl.makeXRCompatible();
      
      this.xrSession.updateRenderState({
        baseLayer: new XRWebGLLayer(this.xrSession, this.arScene.gl)
      });

      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');

      this.xrSession.addEventListener('end', () => {
        this.ui.log('Session ended', 'warn');
        this.xrSession = null;
        this.isSceneReady = false;
        this.ui.enableArButton();
        this.ui.setHint('AR сессия завершена');
      });

      const success = await this.calibration.runCalibration(this.xrSession);
      
      if (success) {
        this.isSceneReady = true;
        this.ui.setHint('Сцена активна. Ищите маркер.');
        this.ui.log('Основная сцена запущена', 'ok');
      }

      this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

    } catch (err) {
      this.ui.log('Start AR Error: ' + err.message, 'err');
      this.ui.setHint('Ошибка запуска: ' + err.message);
      this.ui.enableArButton();
    }
  }

  onXRFrame(time, frame) {
    if (!this.xrSession) return;

    this.xrSession.requestAnimationFrame((t, f) => this.onXRFrame(t, f));
    this.frameCount++;

    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    if (this.isSceneReady) {
      this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      this.recognition.updateAnchors(frame, this.xrRefSpace);
    }

    const gl = this.arScene.gl;
    const layer = this.xrSession.renderState.baseLayer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.isSceneReady) {
      for (const view of pose.views) {
        const viewport = layer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        this.arScene.renderView(view.projectionMatrix, view.transform.inverse.matrix);
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});