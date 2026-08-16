import * as THREE from 'three';

export class ARScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 50);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    this.sphereGeo = new THREE.SphereGeometry(0.12, 32, 32);
    this.testAnchors = [];
    
    // Группа для всех статических элементов мира
    this.worldGroup = new THREE.Group();
    this.worldAnchor = null;

    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 5, 2);
    this.scene.add(sun);

    // Добавляем статическое окружение в worldGroup
    const grid = new THREE.GridHelper(4, 4, 0x00aaff, 0x555555);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.worldGroup.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    this.worldGroup.add(floor);

    const s = 0.35, d = 1.3;
    const cubeGeo = new THREE.BoxGeometry(s, s, s);
    const colors = [0xff3366, 0x33ff66, 0x3366ff, 0xffcc00];
    [[-d, s / 2, -d], [d, s / 2, -d], [-d, s / 2, d], [d, s / 2, d]].forEach((pos, i) => {
      const m = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.1 });
      const c = new THREE.Mesh(cubeGeo, m);
      c.position.set(...pos);
      this.worldGroup.add(c);
    });

    // Включаем группу в сцену
    this.scene.add(this.worldGroup);
  }

  setWorldAnchor(anchor) {
    this.worldAnchor = anchor;
  }

  createSphereMesh(colorHex) {
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.2, metalness: 0.5 });
    return new THREE.Mesh(this.sphereGeo, mat);
  }

  addTestAnchor(anchor, sphere) {
    this.scene.add(sphere);
    this.testAnchors.push({ anchor, sphere });
  }

  updateWorldAnchor(frame, xrRefSpace) {
    if (this.worldAnchor) {
      const pose = frame.getPose(this.worldAnchor.anchorSpace, xrRefSpace);
      if (pose) {
        const t = pose.transform;
        this.worldGroup.position.set(t.position.x, t.position.y, t.position.z);
        this.worldGroup.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
      }
    }
  }

  updateTestAnchors(frame, xrRefSpace) {
    for (const { anchor, sphere } of this.testAnchors) {
      const pose = frame.getPose(anchor.anchorSpace, xrRefSpace);
      if (pose) {
        const t = pose.transform;
        sphere.position.set(t.position.x, t.position.y, t.position.z);
        sphere.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}