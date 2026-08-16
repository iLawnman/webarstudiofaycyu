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
    this.cubesGroup = null;

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

    // Отображение сетки на установленном полу
    const grid = new THREE.GridHelper(2, 10, 0x00ff88, 0x444444);
    this.floorGroup.add(grid);

    // Спавн кубов по углам
    this.spawnCornerCubes();

    this.ui.log('Пол зафиксирован. Кубы размещены по углам.', 'ok');
  }

  // Создание и анимация 4 кубов по углам квадратной области (1x1 м)
  spawnCornerCubes() {
    if (this.cubesGroup) this.floorGroup.remove(this.cubesGroup);

    this.cubesGroup = new THREE.Group();
    this.floorGroup.add(this.cubesGroup);

    const cubeSize = 0.15; // 15см
    const boxGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const boxMat = new THREE.MeshStandardMaterial({ 
      color: 0x00aeff, 
      roughness: 0.3,
      metalness: 0.2
    });

    // Углы квадрата со стороной 1 метр (+-0.5м от центра калибровки)
    const corners = [
      [-0.5, -0.5],
      [ 0.5, -0.5],
      [-0.5,  0.5],
      [ 0.5,  0.5]
    ];

    corners.forEach(([x, z], index) => {
      const cube = new THREE.Mesh(boxGeo, boxMat);
      
      // Ставим куб точно НА пол (высота/2)
      cube.position.set(x, cubeSize / 2, z);
      cube.scale.set(0, 0, 0); // Начинаем с 0 для анимации
      
      this.cubesGroup.add(cube);

      // Анимация появления кубов
      setTimeout(() => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.1;
          cube.scale.set(progress, progress, progress);
          if (progress >= 1) {
            cube.scale.set(1, 1, 1);
            clearInterval(interval);
          }
        }, 16);
      }, index * 150);
    });
  }

  updateAnimation(time) {
    // Вращение кубов для наглядности активной сцены
    if (this.cubesGroup) {
      this.cubesGroup.children.forEach((cube) => {
        cube.rotation.y += 0.01;
      });
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