export class RecognitionManager {
  constructor(ui) {
    this.ui = ui;
    this.targetBitmap = null;
  }

  async initTarget(url) {
    this.ui.log(`Loading target from: ${url}`, 'info');

    try {
      // 1. Попытка загрузить через fetch + createImageBitmap
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fetch status: ${response.status}`);
      }
      
      const blob = await response.blob();
      this.targetBitmap = await createImageBitmap(blob);
      
      this.ui.log(`Target loaded successfully (${this.targetBitmap.width}x${this.targetBitmap.height})`, 'ok');
      
      // Выводим превью в UI
      if (typeof this.ui.setPreview === 'function') {
        this.ui.setPreview(url);
      }
    } catch (err) {
      this.ui.log(`Target load failed (${err.message}), trying Image() fallback...`, 'warn');
      
      // Fallback вариант
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        
        this.targetBitmap = await createImageBitmap(img);
        this.ui.log('Target loaded via Image() decode', 'ok');

        if (typeof this.ui.setPreview === 'function') {
          this.ui.setPreview(url);
        }
      } catch (fallbackErr) {
        this.ui.log(`All loaders failed for ${url}. Generating fallback bitmap...`, 'err');
        await this.generateFallbackBitmap();
      }
    }
  }

  async generateFallbackBitmap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Простой узор для фоллбека
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 472, 472);

    this.targetBitmap = await createImageBitmap(canvas);
    this.ui.log('Fallback bitmap 512x512 ready', 'ok');

    if (typeof this.ui.setPreview === 'function') {
      this.ui.setPreview(canvas.toDataURL());
    }
  }

  processTracking(frame, refSpace, frameCount, arScene) {
    if (!frame.getImageTrackingResults) return;

    const results = frame.getImageTrackingResults();
    for (const result of results) {
      const pose = frame.getPose(result.imageSpace, refSpace);
      if (pose) {
        if (result.trackingState === 'tracked') {
          // Выполняем позиционирование или привязку объектов к таргету
          if (frameCount % 60 === 0) {
            this.ui.log('ImageTarget tracked successfully', 'ok');
          }
        }
      }
    }
  }

  updateAnchors(frame, refSpace) {
    // Обновление WebXR анкоров при необходимости
  }
}