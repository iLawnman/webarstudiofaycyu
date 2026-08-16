export class RecognitionManager {
  constructor(ui) {
    this.ui = ui;
    this.targetBitmap = null;
    this.trackedMarkers = new Map();
  }

  // Внутри метода init() в app.js:
  
  async makeGeneratedBitmap() {
    this.ui.log('Generating fallback bitmap...', 'warn');
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#e0e0e0';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360},70%,50%)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 25 + 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.stroke();
    }
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const bmp = await createImageBitmap(blob);
    this.ui.log('Fallback bitmap 512x512 ready', 'ok');
    return bmp;
  }

  async loadTargetImage(src) {
    this.ui.log('Loading target from: ' + src, 'info');
    try {
      this.ui.log('Trying fetch...', 'info');
      const res = await fetch(src);
      this.ui.log('Fetch status: ' + res.status + ' ' + res.statusText, res.ok ? 'ok' : 'warn');
      if (res.ok) {
        const blob = await res.blob();
        this.ui.log('Blob: size=' + blob.size + ' type=' + blob.type, 'info');
        const bmp = await createImageBitmap(blob);
        this.ui.log('Bitmap from fetch: ' + bmp.width + 'x' + bmp.height, 'ok');
        return { bmp, source: 'fetch' };
      }
    } catch (e) {
      this.ui.log('Fetch failed: ' + e.message, 'err');
    }

    this.ui.log('Trying Image() loader...', 'warn');
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.ui.log('Image loaded: ' + img.width + 'x' + img.height, 'ok');
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        c.toBlob(async (blob) => {
          const bmp = await createImageBitmap(blob);
          this.ui.log('Bitmap from Image(): ' + bmp.width + 'x' + bmp.height, 'ok');
          resolve({ bmp, source: 'image' });
        }, 'image/png');
      };
      img.onerror = () => {
        this.ui.log('Image() failed', 'err');
        resolve(null);
      };
      img.src = src;
    });
  }

  async initTarget(src) {
    const result = await this.loadTargetImage(src);
    if (result && result.bmp) {
      this.targetBitmap = result.bmp;
      this.ui.log('Target ready via ' + result.source, 'ok');
      this.ui.setPreview(src);
    } else {
      this.ui.log('All loaders failed, using generated fallback', 'err');
      this.targetBitmap = await this.makeGeneratedBitmap();
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ff0055'; ctx.fillRect(32, 32, 64, 64);
      this.ui.setPreview(c.toDataURL());
    }
    this.ui.setHint('Нажмите «Start AR». Камера на 1.6 м. Покажите картинку.');
    this.ui.enableArButton();
  }

  processTracking(frame, xrRefSpace, frameCount, arScene) {
    try {
      const results = frame.getImageTrackingResults();
      for (const result of results) {
        const state = result.trackingState;
        const idx = result.index;

        if (state === 'tracked' && !this.trackedMarkers.has(idx)) {
          const pose = frame.getPose(result.imageSpace, xrRefSpace);
          if (pose) {
            this.ui.log('[' + idx + '] Creating anchor...', 'info');
            frame.createAnchor(pose.transform, xrRefSpace).then(anchor => {
              // Чистый WebGL маркер вместо Three.js Mesh
              const markerNode = arScene.createMarkerNode([1.0, 0.0, 1.0]); // Малиновый цвет
              arScene.addNode(markerNode);
              
              this.trackedMarkers.set(idx, { anchor, node: markerNode });
              this.ui.log('[' + idx + '] Anchor + marker CREATED', 'ok');
              this.ui.setHint('Картинка найдена! Метка зафиксирована.');
            }).catch(err => {
              this.ui.log('[' + idx + '] Anchor failed: ' + err.message, 'err');
            });
          } else {
            this.ui.log('[' + idx + '] Pose is null', 'warn');
          }
        }
        if (state === 'ended' && this.trackedMarkers.has(idx)) {
          this.ui.log('[' + idx + '] Tracking ended (marker stays)', 'warn');
        }
      }
    } catch (e) {
      if (frameCount % 60 === 0) this.ui.log('getImageTrackingResults err: ' + e.message, 'err');
    }
  }

  updateAnchors(frame, xrRefSpace) {
    for (const { anchor, node } of this.trackedMarkers.values()) {
      const pose = frame.getPose(anchor.anchorSpace, xrRefSpace);
      if (pose) {
        // Записываем матрицу из WebXR XRRigidTransform в узлы сцены
        node.matrix.set(pose.transform.matrix);
      }
    }
  }
}