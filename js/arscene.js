import * as THREE from 'three';

export class ARScene {
  constructor(ui) {
    this.ui = ui;
    this.scene = new THREE.Scene();
    
    // Корневая группа, привязанная к откалиброванному полу
    this.floorGroup = new THREE.Group();
    this.scene.add(this.floorGroup);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.gl = this.renderer.getContext();

    this.camera = new THREE.PerspectiveCamera();
    this.buildingGroup = null;

    this.initLights();
  }

  initLights() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 10, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 5, 2);
    this.scene.add(dirLight);
  }

  // Применяем зафиксированную матрицу калиброванного пола
  setFloor(floorMatrix) {
    this.floorGroup.matrix.copy(floorMatrix);
    this.floorGroup.matrixAutoUpdate = false;

    // Сетка на полу
    const grid = new THREE.GridHelper(4, 12, 0x00ff88, 0x444444);
    this.floorGroup.add(grid);

    this.ui.log('Положение пола обновлено в Three.js сцене', 'ok');
  }

  // Визуальная анимация постройки сцены
  startConstructionAnimation() {
    if (this.buildingGroup) this.floorGroup.remove(this.buildingGroup);

    this.buildingGroup = new THREE.Group();
    this.floorGroup.add(this.buildingGroup);

    const boxGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
    const matWire = new THREE.MeshStandardMaterial({ color: 0x00aeff, wireframe: true });
    const matSolid = new THREE.MeshStandardMaterial({ color: 0x00aeff, transparent: true, opacity: 0.5 });

    const coords = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]];

    coords.forEach(([x, z], i) => {
      setTimeout(() => {
        const pillar = new THREE.Group();
        pillar.add(new THREE.Mesh(boxGeo, matWire));
        pillar.add(new THREE.Mesh(boxGeo, matSolid));

        pillar.position.set(x, 0, z);
        pillar.scale.set(1, 0.01, 1);
        this.buildingGroup.add(pillar);

        let s = 0.01;
        const interval = setInterval(() => {
          s += 0.05;
          pillar.scale.y = s;
          pillar.position.y = (s * 0.5) / 2;
          if (s >= 1) {
            pillar.scale.y = 1;
            pillar.position.y = 0.25;
            clearInterval(interval);
          }
        }, 16);
      }, i * 200);
    });
  }

  updateAnimation() {
    if (this.buildingGroup) {
      this.buildingGroup.rotation.y += 0.003;
    }
  }

  add(object) { this.scene.add(object); }
  remove(object) { this.scene.remove(object); }

  renderView(projectionMatrix, viewMatrix) {
    this.camera.projectionMatrix.fromArray(projectionMatrix);
    this.camera.matrixWorldInverse.fromArray(viewMatrix);
    this.camera.matrixWorld.copy(this.camera.matrixWorldInverse).invert();

    this.renderer.render(this.scene, this.camera);
  }
}