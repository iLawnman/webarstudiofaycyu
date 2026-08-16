import * as THREE from 'three';
import { UI } from './ui.js';
import { ARScene } from './arscene.js';
import { RecognitionManager } from './recognition.js';

class App {
  constructor() {
    this.ui = new UI();
    this.arScene = new ARScene();
    this.recognition = new RecognitionManager(this.ui);

    this.imageTrackingEnabled = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.currentFrame = null;
    this.frameCount = 0;
    this.worldAnchorRequested = false;

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
    this.worldAnchorRequested = false;

    if (!navigator.xr) {
      this.ui.log('navigator.xr missing', 'err');
      this.ui.setHint('WebXR не поддерживается');
      return;
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    this.ui.log('immersive-ar supported: ' + supported, supported ? 'ok' : 'err');
    if (!supported) {
      this.ui.setHint('immersive-ar не поддерживается');
      return;
    }

    try {
      this.ui.log('Requesting session with dom-overlay...', 'info');
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['image-tracking', 'anchors', 'dom-overlay'],
        trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }],
        domOverlay: { root: document.body }
      });
    } catch (e) {
      this.ui.log('Session with dom-overlay failed: ' + e.message, 'warn');
      this.ui.log('Retrying without dom-overlay...', 'warn');
      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['image-tracking', 'anchors'],
          trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }]
        });
      } catch (e2) {
        this.ui.log('Session request FAILED: ' + e2.message, 'err');
        this.ui.setHint('Ошибка запуска AR: ' + e2.message);
        this.ui.enableArButton();
        return;
      }
    }

    await this.arScene.renderer.xr.setSession(this.xrSession);
    this.ui.log('Renderer session set', 'ok');

    try {
      const enabled = this.xrSession.enabledFeatures || [];
      this.ui.log('enabledFeatures: [' + enabled.join(', ') + ']', 'info');
      this.imageTrackingEnabled = enabled.includes('image-tracking');
    } catch (e) {
      this.imageTrackingEnabled = true;
      this.ui.log('enabledFeatures not available, assuming image-tracking ok', 'warn');
    }
    this.ui.log('image-tracking active: ' + this.imageTrackingEnabled, this.imageTrackingEnabled ? 'ok' : 'warn');

    let baseRef = await this.xrSession.requestReferenceSpace('local-floor');
    const offset = new XRRigidTransform({ x: 0, y: -1, z: 0 });
    this.xrRefSpace = baseRef.getOffsetReferenceSpace(offset);
    this.arScene.renderer.xr.setReferenceSpace(this.xrRefSpace);
    this.ui.log('RefSpace: local-floor + Y=1.6m', 'ok');

    this.ui.setHint(this.imageTrackingEnabled
      ? 'AR активен. Наведите на картинку (реальный размер ~20 см).'
      : 'AR активен. Image-tracking НЕ включён — используйте «Test Anchor».');
    this.ui.enableTestButton();

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.imageTrackingEnabled = false;
      this.xrSession = null;
      this.currentFrame = null;
      this.worldAnchorRequested = false;
      this.ui.enableArButton();
      this.ui.disableTestButton();
    });
  }

  async createInitialWorldAnchor(frame) {
    if (this.worldAnchorRequested || !frame || !this.xrRefSpace) return;
    this.worldAnchorRequested = true;

    try {
      // Инициализируем якорь пола в нулевой точке reference space
      const identityTransform = new XRRigidTransform({ x: 0, y: 0, z: 0 });
      const anchor = await frame.createAnchor(identityTransform, this.xrRefSpace);
      this.arScene.setWorldAnchor(anchor);
      this.ui.log('World Scene Anchor established successfully', 'ok');
    } catch (e) {
      this.ui.log('Failed to create World Anchor: ' + e.message, 'err');
    }
  }

  async addTestAnchor() {
    if (!this.xrSession || !this.xrRefSpace || !this.currentFrame) {
      this.ui.log('No active frame for anchor', 'err');
      return;
    }
    this.ui.log('Test Anchor clicked', 'info');

    const vp = this.currentFrame.getViewerPose(this.xrRefSpace);
    if (!vp) {
      this.ui.log('No viewer pose', 'err');
      return;
    }

    const p = vp.transform.position;
    const q = vp.transform.orientation;
    const fwd = new THREE.Vector3(0, 0, -1.5).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const pos = { x: p.x + fwd.x, y: p.y + fwd.y, z: p.z + fwd.z };

    try {
      const anchor = await this.currentFrame.createAnchor(new XRRigidTransform(pos, q), this.xrRefSpace);
      const sph = this.arScene.createSphereMesh(0x00ff88);
      this.arScene.addTestAnchor(anchor, sph);
      this.ui.log('Test anchor OK at ' + pos.x.toFixed(2) + ',' + pos.y.toFixed(2) + ',' + pos.z.toFixed(2), 'ok');
    } catch (e) {
      this.ui.log('Test anchor FAILED: ' + e.message, 'err');
    }
  }

  onFrame(time, frame) {
    this.frameCount++;
    this.currentFrame = frame;

    if (frame && this.xrRefSpace) {
      // Инициализируем якорь сцены на первом же кадре
      if (!this.worldAnchorRequested) {
        this.createInitialWorldAnchor(frame);
      }

      if (this.frameCount % 150 === 0) {
        const vp = frame.getViewerPose(this.xrRefSpace);
        if (vp) {
          const p = vp.transform.position;
          this.ui.log('Cam ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ' ' + p.z.toFixed(2), 'info');
        }
      }

      if (this.imageTrackingEnabled) {
        this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      }

      // Обновляем позиции на основе якорей
      this.arScene.updateWorldAnchor(frame, this.xrRefSpace);
      this.recognition.updateAnchors(frame, this.xrRefSpace);
      this.arScene.updateTestAnchors(frame, this.xrRefSpace);
    }

    this.arScene.render();
  }
}

new App();