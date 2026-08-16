// js/app.js

export class App {
  constructor() {
    this.ui = new UI();
    this.recognition = new ImageRecognition(this.ui);
    this.arScene = new ARScene(this.ui);

    this.xrSession = null;
    this.imageTrackingEnabled = false;

    // ВАЖНО: Задаем тип reference space до старта сессии для Three.js!
    // Three.js сам запросит 'local-floor' и привяжет (0,0,0) к полу комнаты.
    this.arScene.renderer.xr.setReferenceSpaceType('local-floor');

    this.init();
  }

  async init() {
    this.ui.log('App init...', 'info');
    await this.recognition.init();
    this.ui.bindStartAr(() => this.startAR());

    // Анимационный цикл Three.js
    this.arScene.renderer.setAnimationLoop((timestamp, frame) => {
      this.onXRFrame(timestamp, frame);
    });
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
        optionalFeatures: ['image-tracking', 'dom-overlay'],
        trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }],
        domOverlay: { root: document.body }
      });
    } catch (e) {
      this.ui.log('Session with dom-overlay failed, retrying without it...', 'warn');
      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['image-tracking'],
          trackedImages: [{ image: this.recognition.targetBitmap, widthInMeters: 0.2 }]
        });
      } catch (e2) {
        this.ui.log('Session request FAILED: ' + e2.message, 'err');
        this.ui.setHint('Ошибка запуска AR: ' + e2.message);
        this.ui.enableArButton();
        return;
      }
    }

    // Привязываем сессию к Three.js
    await this.arScene.renderer.xr.setSession(this.xrSession);
    this.ui.log('Renderer session set with local-floor', 'ok');

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.imageTrackingEnabled = false;
      this.xrSession = null;
      this.ui.enableArButton();
    });
  }

  onXRFrame(timestamp, frame) {
    if (!frame) {
      this.arScene.render();
      return;
    }

    // Если используется Image Tracking — обновляем сцену относительно картинки,
    // в противном случае scene остаётся неподвижно привязана к local-floor (0,0,0)
    if (this.imageTrackingEnabled) {
      this.checkImageTracking(frame);
    }

    this.arScene.render();
  }

  checkImageTracking(frame) {
    const results = frame.getImageTrackingResults ? frame.getImageTrackingResults() : [];
    if (!results || results.length === 0) return;

    const refSpace = this.arScene.renderer.xr.getReferenceSpace();
    if (!refSpace) return;

    for (const result of results) {
      const pose = frame.getPose(result.imageSpace, refSpace);
      if (pose) {
        // Устанавливаем положение объектов по трекингу маркера
        this.arScene.updateWorldMatrixFromPose(pose.transform.matrix);
      }
    }
  }
}