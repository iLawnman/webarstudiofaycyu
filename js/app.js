// js/app.js

export class App {
  constructor() {
    this.ui = new UI();
    this.arScene = new ARScene(this.ui);
    this.recognition = new RecognitionManager(this.ui);
    this.calibration = new CalibrationManager(this.ui);

    this.imageTrackingEnabled = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.currentFrame = null;
    this.frameCount = 0;

    this.init();
  }

  async init() {
    this.ui.log('App initialization started...', 'info');

    try {
      // 1. Устанавливаем рендерер Three.js в режим анимированного цикла СРАЗУ,
      // чтобы сцена рендерилась даже до входа в AR
      this.arScene.renderer.setAnimationLoop((time, frame) => this.onFrame(time, frame));

      // 2. Безопасная загрузка изображения с таймаутом в 3 секунды
      const loadPromise = this.recognition.initTarget('./assets/T1.jpg');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading T1.jpg')), 3000)
      );

      await Promise.race([loadPromise, timeoutPromise]).catch(err => {
        this.ui.log('Warning: Image target failed to load: ' + err.message, 'warn');
        this.ui.log('Continuing without image-tracking...', 'warn');
      });

      this.ui.log('App ready. Tap Start AR.', 'ok');
    } catch (e) {
      this.ui.log('Init Critical Error: ' + e.message, 'err');
    }

    this.ui.onStartAR(() => this.startAR());
    this.ui.onTestAnchor(() => this.addTestAnchor());

    window.addEventListener('resize', () => this.arScene.onWindowResize());
  }

  async startAR() {
    this.ui.disableArButton();
    this.ui.log('>>> Requesting AR Session...', 'info');

    if (!navigator.xr) {
      this.ui.log('WebXR not supported', 'err');
      this.ui.setHint('WebXR не поддерживается');
      return;
    }

    // Формируем конфигурацию сессии
    const sessionOptions = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['anchors', 'dom-overlay'],
      domOverlay: { root: document.body }
    };

    // Если картинка загрузилась, добавляем image-tracking
    if (this.recognition.targetBitmap) {
      sessionOptions.optionalFeatures.push('image-tracking');
      sessionOptions.trackedImages = [{ 
        image: this.recognition.targetBitmap, 
        widthInMeters: 0.2 
      }];
    }

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionOptions);
    } catch (e) {
      this.ui.log('Fallback: Retrying session without dom-overlay...', 'warn');
      delete sessionOptions.domOverlay;
      try {
        this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionOptions);
      } catch (e2) {
        this.ui.log('Session Start Failed: ' + e2.message, 'err');
        this.ui.enableArButton();
        return;
      }
    }

    // Привязываем сессию WebXR к Three.js
    await this.arScene.renderer.xr.setSession(this.xrSession);

    // Запрашиваем local-floor
    this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');
    this.arScene.renderer.xr.setReferenceSpace(this.xrRefSpace);

    this.ui.log('AR Session running', 'ok');

    // Запускаем калибровку
    this.calibration.start(() => {
      this.ui.setHint('Калибровка завершена');
      this.ui.enableTestButton();
    });

    this.xrSession.addEventListener('end', () => {
      this.ui.log('Session ended', 'warn');
      this.calibration.cancel();
      this.xrSession = null;
      this.xrRefSpace = null;
      this.ui.enableArButton();
      this.ui.disableTestButton();
    });
  }

  onFrame(time, frame) {
    this.frameCount++;
    this.currentFrame = frame;

    if (frame && this.xrRefSpace) {
      // Обновляем калибровку
      if (this.calibration.isCalibrating) {
        this.calibration.update(frame, this.xrRefSpace);
      }

      // Вызов распознавания (если активен)
      if (this.imageTrackingEnabled) {
        this.recognition.processTracking(frame, this.xrRefSpace, this.frameCount, this.arScene);
      }
    }

    // Рендерим Three.js сцену
    this.arScene.render();
  }
}