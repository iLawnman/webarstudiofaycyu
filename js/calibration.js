import * as THREE from 'three';

export class CalibrationManager {
  constructor(ui, arScene) {
    this.ui = ui;
    this.arScene = arScene;
    this.reticle = null;
    this.hitTestSource = null;
    this.calibratedMatrix = null;

    this.initReticle();
  }

  initReticle() {
    const ringGeo = new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeo, ringMat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
  }

  async runCalibration(session, refSpace) {
    this.arScene.add(this.reticle);
    this.ui.setHint('Наведите камеру на пол для калибровки...');

    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    return new Promise((resolve) => {
      const onFrame = (time, frame) => {
        if (!this.hitTestSource) return;

        const hitResults = frame.getHitTestResults(this.hitTestSource);
        if (hitResults.length > 0) {
          const hit = hitResults[0];
          const pose = hit.getPose(refSpace);

          this.reticle.visible = true;
          this.reticle.matrix.fromArray(pose.transform.matrix);
          this.ui.setHint('Пол найден! Коснитесь экрана для подтверждения.');
        } else {
          this.reticle.visible = false;
          this.ui.setHint('Сканируйте пол...');
        }

        session.requestAnimationFrame(onFrame);
      };

      const SelectHandler = () => {
        if (this.reticle.visible) {
          this.calibratedMatrix = this.reticle.matrix.clone();
          this.reticle.visible = false;
          this.arScene.remove(this.reticle);
          
          if (this.hitTestSource) {
            this.hitTestSource.cancel();
            this.hitTestSource = null;
          }

          session.removeEventListener('select', SelectHandler);
          resolve(this.calibratedMatrix);
        }
      };

      session.addEventListener('select', SelectHandler);
      session.requestAnimationFrame(onFrame);
    });
  }
}