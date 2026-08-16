// js/recognition.js
import * as THREE from 'three';
import { createArTarget } from './artarget.js';

export class ImageRecognition {
  constructor(ui) {
    this.ui = ui;
    this.targetBitmap = null;
    this.trackedMarkers = new Map();
    // waitingImage  — ждём распознавания маркера
    // waitingInput  — маркер найден, ждём нажатия OK
    this.state = 'waitingImage';

    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2(0, 0);
    this._boundOnSelect = null;
    this._boundOnClick = null;
    this._arScene = null;
    this._xrSession = null;
  }

  async makeGeneratedBitmap() {
    this.ui.log('Generating fallback bitmap...', 'warn');
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 512);
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
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
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
        c.width = img.width;
        c.height = img.height;
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

  async init(src = './assets/T1.jpg') {
    this.state = 'waitingImage';
    const result = await this.loadTargetImage(src);
    if (result && result.bmp) {
      this.targetBitmap = result.bmp;
      this.ui.log('Target ready via ' + result.source, 'ok');
      this.ui.setPreview(src);
    } else {
      this.ui.log('All loaders failed for ' + src + ', using generated fallback', 'err');
      this.targetBitmap = await this.makeGeneratedBitmap();
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(32, 32, 64, 64);
      this.ui.setPreview(c.toDataURL());
    }
    this.ui.setHint('Нажмите «Start AR». Камера на 1.6 м. Покажите картинку T1.jpg.');
    this.ui.enableArButton();
    this.ui.log('state → waitingImage', 'info');
  }

  attachInput(xrSession, arScene) {
    this._xrSession = xrSession;
    this._arScene = arScene;

    this._boundOnSelect = (ev) => this._onSelect(ev);
    xrSession.addEventListener('select', this._boundOnSelect);

    this._boundOnClick = (ev) => this._onCanvasTap(ev);
    arScene.renderer.domElement.addEventListener('click', this._boundOnClick);
    arScene.renderer.domElement.addEventListener('touchend', this._boundOnClick, { passive: true });
  }

  detachInput() {
    if (this._xrSession && this._boundOnSelect) {
      this._xrSession.removeEventListener('select', this._boundOnSelect);
    }
    if (this._arScene && this._boundOnClick) {
      this._arScene.renderer.domElement.removeEventListener('click', this._boundOnClick);
      this._arScene.renderer.domElement.removeEventListener('touchend', this._boundOnClick);
    }
    this._xrSession = null;
    this._arScene = null;
    this._boundOnSelect = null;
    this._boundOnClick = null;
  }

  _onSelect(ev) {
    if (this.state !== 'waitingInput' || !this._arScene) return;
    this._pointerNdc.set(0, 0);
    this._tryHitOk();
  }

  _onCanvasTap(ev) {
    if (this.state !== 'waitingInput' || !this._arScene) return;
    const rect = this._arScene.renderer.domElement.getBoundingClientRect();
    let clientX, clientY;
    if (ev.changedTouches && ev.changedTouches.length) {
      clientX = ev.changedTouches[0].clientX;
      clientY = ev.changedTouches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    this._pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._tryHitOk();
  }

  _tryHitOk() {
    if (!this._arScene) return;
    const camera = this._arScene.camera;
    this._raycaster.setFromCamera(this._pointerNdc, camera);

    for (const [, entry] of this.trackedMarkers) {
      if (!entry.arTarget || !entry.arTarget.visible || entry.dismissed) continue;
      const okPanel = entry.arTarget.userData.okPanel;
      if (!okPanel) continue;
      const hits = this._raycaster.intersectObject(okPanel, false);
      if (hits.length > 0) {
        this._handleOk(entry);
        return;
      }
    }

    // mobile UX: one visible target → any tap = OK
    if (this.state === 'waitingInput') {
      for (const [, entry] of this.trackedMarkers) {
        if (entry.arTarget && entry.arTarget.visible && !entry.dismissed) {
          this._handleOk(entry);
          return;
        }
      }
    }
  }

  _handleOk(entry) {
    if (entry.dismissed) return;
    entry.dismissed = true;
    if (entry.arTarget) {
      entry.arTarget.visible = false;
    }
    this.state = 'waitingImage';
    this.ui.log('OK → AR Target hidden, state → waitingImage', 'ok');
    this.ui.setHint('Ожидание маркера… Покажите картинку снова.');
  }

  processTracking(frame, xrRefSpace, frameCount, arScene) {
    try {
      if (!frame.getImageTrackingResults) return;

      const results = frame.getImageTrackingResults();
      const seen = new Set();

      for (const result of results) {
        const trackingState = result.trackingState;
        const idx = result.index;
        seen.add(idx);

        const pose = frame.getPose(result.imageSpace, xrRefSpace);
        if (!pose) continue;

        let entry = this.trackedMarkers.get(idx);

        if (!entry) {
          if (this.state !== 'waitingImage') continue;

          const markerName = 'T' + (idx + 1);
          const arTarget = createArTarget(markerName, {
            onOk: () => {
              const e = this.trackedMarkers.get(idx);
              if (e) this._handleOk(e);
            }
          });
          arScene.scene.add(arTarget);
          entry = { arTarget, lastState: trackingState, dismissed: false };
          this.trackedMarkers.set(idx, entry);

          this.state = 'waitingInput';
          this.ui.log('[' + idx + '] AR Target created: ' + markerName + ' (state=' + trackingState + ')', 'ok');
          this.ui.log('state → waitingInput', 'info');
          this.ui.setHint('Картинка ' + markerName + ' найдена! Нажмите OK.');
        }

        if (entry.dismissed) {
          entry.lastState = trackingState;
          continue;
        }

        const t = pose.transform;
        entry.arTarget.position.set(t.position.x, t.position.y, t.position.z);
        entry.arTarget.quaternion.set(
            t.orientation.x,
            t.orientation.y,
            t.orientation.z,
            t.orientation.w
        );
        entry.lastState = trackingState;

        if (trackingState === 'emulated') {
          entry.arTarget.scale.setScalar(0.7);
        } else {
          entry.arTarget.scale.setScalar(1.0);
        }
      }

      for (const [idx, entry] of this.trackedMarkers) {
        if (!seen.has(idx) && entry.lastState !== 'lost') {
          entry.lastState = 'lost';
          this.ui.log('[' + idx + '] Tracking lost', 'warn');

          if (entry.arTarget) {
            arScene.scene.remove(entry.arTarget);
            this._disposeTarget(entry.arTarget);
          }
          this.trackedMarkers.delete(idx);

          if (this.state === 'waitingInput') {
            this.state = 'waitingImage';
            this.ui.log('state → waitingImage (lost before OK)', 'info');
            this.ui.setHint('Маркер потерян. Покажите картинку снова.');
          }
        }
      }
    } catch (e) {
      if (frameCount % 60 === 0) {
        this.ui.log('getImageTrackingResults err: ' + e.message, 'err');
      }
    }
  }

  _disposeTarget(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
}