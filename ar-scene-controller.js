/* ============================================================
   ArSceneController — сцена A-Frame, объекты, resize, loader
   ============================================================ */
export class ArSceneController {
  constructor(ui, settings) {
    this.ui = ui;
    this.settings = settings || {};
    this.els = {};
  }

  init() {
    this._cacheDOM();
    this._bindEvents();
    this._startTimers();
  }

  _cacheDOM() {
    var s = this.settings;
    this.els.scene       = document.getElementById(s.sceneId || 'scene');
    this.els.groundPlane = document.getElementById(s.groundPlaneId || 'groundPlane');
    this.els.worldSphere = document.getElementById(s.worldSphereId || 'worldSphere');
  }

  _bindEvents() {
    var self = this;
    this.els.scene.addEventListener('loaded', function(){
      self.ui.hideLoader();
    });
    this.els.scene.addEventListener('camera-error', function(e){
      self.ui.setDiag('камера: нет доступа', true);
      console.error('camera-error', e.detail);
    });
    window.addEventListener('resize', function(){
      setTimeout(function(){ self.forceCssSize(); }, 50);
    });
    window.addEventListener('orientationchange', function(){
      setTimeout(function(){ self.forceCssSize(); }, 300);
    });
  }

  _startTimers() {
    var self = this;
    var timers = this.settings.timers || {};

    setTimeout(function(){ self.ui.hideLoader(); }, timers.loaderFallbackMs || 4000);

    var sizeDelays = timers.forceCssSizeDelaysMs || [300, 1000, 2500];
    sizeDelays.forEach(function(ms){
      setTimeout(function(){ self.forceCssSize(); }, ms);
    });

    setTimeout(function(){
      var video = document.querySelector('video');
      if (video) console.log('video ' + video.videoWidth + 'x' + video.videoHeight);
      else console.warn('no video');
    }, timers.videoInfoDelayMs || 2000);
  }

  forceCssSize() {
    var w = window.innerWidth, h = window.innerHeight;
    var video = document.querySelector('video');
    var canvas = document.querySelector('canvas.a-canvas');
    if (video) {
      video.style.setProperty('width', w+'px', 'important');
      video.style.setProperty('height', h+'px', 'important');
    }
    if (canvas) {
      canvas.style.setProperty('width', w+'px', 'important');
      canvas.style.setProperty('height', h+'px', 'important');
    }
    var key = w+'x'+h;
    if (key !== this.lastViewport) {
      this.lastViewport = key;
      console.log('viewport '+key);
    }
  }

  placeWorldAnchor(markerEl, label) {
    if (!markerEl || !markerEl.object3D) return;
    var THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
    if (!THREE) {
      console.warn('THREE не найден, якорь не создан');
      return;
    }
    var worldPos = new THREE.Vector3();
    var worldQuat = new THREE.Quaternion();
    markerEl.object3D.updateMatrixWorld(true);
    markerEl.object3D.getWorldPosition(worldPos);
    markerEl.object3D.getWorldQuaternion(worldQuat);

    var anchor = document.createElement('a-entity');
    anchor.setAttribute('id', 'world-anchor-' + label);
    anchor.setAttribute('position', worldPos.x + ' ' + worldPos.y + ' ' + worldPos.z);

    var text = document.createElement('a-text');
    text.setAttribute('value', label);
    text.setAttribute('position', '1 0 0');
    text.setAttribute('align', 'center');
    text.setAttribute('color', '#e7ecef');
    text.setAttribute('width', '3.5');
    text.setAttribute('scale', '1.2 1.2 1.2');
    text.setAttribute('material', 'shader: flat; transparent: true');
    anchor.appendChild(text);

    this.els.scene.appendChild(anchor);

    if (anchor.object3D) {
      anchor.object3D.position.copy(worldPos);
      anchor.object3D.quaternion.copy(worldQuat);
    }

    console.log('[AR] world anchor placed:', label, worldPos.toArray());
  }
}