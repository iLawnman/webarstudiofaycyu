// js/scene.js
import * as THREE from 'three';

export class ARScene {
  constructor(ui) {
    this.ui = ui;
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;

    document.body.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupStaticFloor();
  }

  setupLighting() {
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    light.position.set(0, 2, 0);
    this.scene.add(light);
  }

  setupStaticFloor() {
    // В local-floor Y = 0 — это абсолютный физический пол.
    // Создаем сетку размером 10x10 метров точно на уровне Y = 0.
    const gridHelper = new THREE.GridHelper(10, 20, 0x00ff00, 0x444444);
    gridHelper.position.set(0, 0, 0);
    this.scene.add(gridHelper);

    // Добавляем тестовый куб на пол в центр комнаты
    const boxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const boxMat = new THREE.MeshNormalMaterial();
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(0, 0.1, -1); // 1 метр перед пользователем, опущен на пол
    this.scene.add(box);
  }

  updateWorldMatrixFromPose(matrixArray) {
    // Если требуется позиционировать сцену по изображению
    // Matrix применится от статического local-floor
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}