import * as THREE from 'three';
import { UI } from './ui.js';
import { ARScene } from './arscene.js';
import { RecognitionManager } from './recognition.js';
import { CalibrationManager } from './calibration.js'; // <-- Новый импорт

export class App {
  constructor() {
    this.ui = new UI();
    this.arScene = new ARScene();
    this.recognition = new RecognitionManager(this.ui);
    this.calibration = new CalibrationManager(this.ui); // <-- Инициализация

    this.imageTrackingEnabled = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.currentFrame = null;
    this.frameCount = 0;

    this.ui.log('BOOT', 'ok');
    this.init();
  }

  async init() {
    await this.recognition.initTarget('./assets/T1.jpg');

    this.ui.onStartAR(() => this.startAR());
    this.ui.onTestAnchor(() => this.addTestAnchor());

    window.addEventListener('resize', () => this.arScene.onWindowResize());

    this.arScene.renderer.setAnimationLoop((time, frame) => this.onFrame(time, frame));
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('>>> Start AR clicked', 'info');

    if (!navigator.xr) {
      this.ui.log('navigator.xr missing', 'err');
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
        optionalFeatures: ['image-tracking', 'anchors', 'dom-overlay'],
        trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }],
        domOverlay: { root: document.body }
      });
    } catch (e) {
      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['image-tracking', 'anchors'],
          trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }]
        });
      } catch (e2) {
        this.ui.log('Session FAILED: ' + e2.message, 'err');
        this.ui.enableArButton();
        return;
      }
    }

    await this.arScene.renderer.xr.setSession(this.xrSession);

    // Устанавливаем базовую систему координат для пола
    this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');
    this.arScene.renderer.xr.setReferenceSpace(this.xrRefSpace);

    // Запускаем калибровку трекинга перед открытием сцены
    this.calibration.start(() => {
      this.ui.setHint('Калибровка завершена. AR сцену зафиксировано.');
      this.ui.enableTestButton();
    });

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.calibration.cancel();
      this.xrSession = null;
      this.ui.enableArButton();
      this.ui.disableTestButton();
    });
  }

  async addTestAnchor() {
    if (!this.xrSession || !this.xrRefSpace || !this.currentFrame) return;

    const vp = this.currentFrame.getViewerPose(this.xrRefSpace);
    if (!vp) return;

    const p = vp.transform.position;
    const q = vp.transform.orientation;
    const fwd = new THREE.Vector3(0, 0, -1.5).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const pos = { x: p.x + fwd.x, y: p.y + fwd.y, z: p.z + fwd.z };

    try {
      const anchor = await this.currentFrame.createAnchor(new XRRigidTransform(pos, q), this.xrRefSpace);
      const sph = this.arScene.createSphereMesh(0x00ff88);
      this.arScene.addTestAnchor(anchor, sph);
      this.ui.log('Test anchor OK', 'ok');
    } catch (e) {
      this.ui.log('Test anchor FAILED: ' + e.message, 'err');
    }
  }

  onFrame(time, frame) {
    this.frameCount++;
    this.currentFrame = frame;

    if (frame && this.xrRefSpace) {
      // Обновляем прогресс калибровки каждый кадр
      if (this.calibration.isCalibrating) {
        this.calibration.update(frame, this.xrRefSpace);
      }

      if (this.imageTrackingEnabled) {
        this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      }

      this.recognition.updateAnchors(frame, this.xrRefSpace);
      this.arScene.updateTestAnchors(frame, this.xrRefSpace);
    }

    this.arScene.render();
  }
}

new App();