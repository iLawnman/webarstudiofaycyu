/* ============================================================
   RecoController — распознавание маркеров, проверка паттернов
   ============================================================ */
export class RecoController {
  constructor(ui, sceneCtrl, settings) {
    this.ui = ui;
    this.sceneCtrl = sceneCtrl;
    this.settings = settings || {};
    this.els = {};
    this.hiroAnchorPlaced = false;
  }

  init() {
    this._cacheDOM();
    this._bindEvents();
    this.checkPattern(this.settings.patternUrl, this.settings.patternLabel);
  }

  _cacheDOM() {
    this.els.markerHiro = document.getElementById(this.settings.markerId || 'markerHiro');
  }

  _bindEvents() {
    var self = this;
    if (!this.els.markerHiro) return;

    this.els.markerHiro.addEventListener('markerFound', function(){
      self.ui.setStatus(true);
      console.log('[AR] markerFound');
      if (self.els.markerHiro.object3D) {
        self.els.markerHiro.object3D.visible = true;
        self.els.markerHiro.object3D.traverse(function(o){ o.visible = true; });
      }
      if (!self.hiroAnchorPlaced) {
        self.sceneCtrl.placeWorldAnchor(self.els.markerHiro, self.settings.anchorLabel || 'Hiro');
        self.hiroAnchorPlaced = true;
      }
    });

    this.els.markerHiro.addEventListener('markerLost', function(){
      self.ui.setStatus(false);
      console.log('[AR] markerLost');
    });
  }

  checkPattern(url, label) {
    var self = this;
    if (!url) { self.ui.setDiag('', false); return; }
    fetch(url, {cache:'no-store'}).then(function(res){
      if (res.ok) {
        self.ui.setDiag(label + ' ✓', false);
      } else {
        self.ui.setDiag(label + ' HTTP ' + res.status, true);
      }
    }).catch(function(){
      self.ui.setDiag('нет файла (нужен http/https)', true);
    });
  }
}