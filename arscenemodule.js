// arscenemodule.js — работа со сценой A-Frame и AR.js

export class ARSceneModule {
  constructor(settings) {
    this.cfg = settings;
    this.scene = null;
    this.marker = null;
    this.groundPlane = null;
    this.worldSphere = null;
  }

  /** Ждём загрузки сцены, кэшируем ссылки на ключевые entity */
  async init() {
    const s = this.cfg.dom.selectors;
    this.scene = document.querySelector(s.scene);
    this.marker = document.querySelector(s.marker);
    this.groundPlane = document.querySelector(s.groundPlane);
    this.worldSphere = document.querySelector(s.worldSphere);

    if (!this.scene) {
      throw new Error('a-scene не найдена в DOM');
    }

    await this._waitForSceneLoaded();
    return this;
  }

  _waitForSceneLoaded() {
    return new Promise((resolve) => {
      if (this.scene.hasLoaded) {
        resolve();
      } else {
        this.scene.addEventListener('loaded', () => resolve(), { once: true });
      }
    });
  }

  getMarker() {
    return this.marker;
  }

  getScene() {
    return this.scene;
  }

  setGroundPlaneVisible(visible) {
    if (this.groundPlane) {
      this.groundPlane.setAttribute('visible', visible);
    }
  }

  setWorldSphereVisible(visible) {
    if (this.worldSphere) {
      this.worldSphere.setAttribute('visible', visible);
    }
  }

  /**
   * Переключение встроенного debugUI от AR.js.
   * Важно: полное переключение требует перезагрузки сцены,
   * поэтому здесь только CSS-уровень + атрибут для новых сессий.
   */
  setDebugUIEnabled(enabled) {
    if (this.scene) {
      this.scene.setAttribute('arjs', 'debugUIEnabled', enabled);
    }
  }
}
