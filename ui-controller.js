/* ============================================================
   UIController — лог-панель, статусы, тогглы, debug overlay
   ============================================================ */
export class UIController {
  constructor(settings) {
    this.settings = settings || {};
    this.els = {};
    this.logCount = 0;
    this.lastViewport = '';
  }

  init() {
    this._cacheDOM();
    this._bindEvents();
    this._hookConsole();
    this.setDebugUi(!!this.settings.debugEnabled);
    console.log('AR v7 start');
  }

  _cacheDOM() {
    this.els.logList      = document.getElementById('logList');
    this.els.logPanel     = document.getElementById('logPanel');
    this.els.logHideBtn   = document.getElementById('logHideBtn');
    this.els.logEar       = document.getElementById('logEar');
    this.els.logClearBtn  = document.getElementById('logClearBtn');
    this.els.statusPill   = document.getElementById('statusPill');
    this.els.statusText   = document.getElementById('statusText');
    this.els.diagStatus   = document.getElementById('diagStatus');
    this.els.debugToggle  = document.getElementById('debugToggle');
    this.els.debugChip    = document.getElementById('debugChip');
    this.els.markerFrame  = document.getElementById('markerFrame');
    this.els.uiToggle     = document.getElementById('uiToggle');
    this.els.loader       = document.getElementById('loader');
  }

  _bindEvents() {
    var self = this;

    this.els.logHideBtn.addEventListener('click', function(){
      self.els.logPanel.classList.add('hidden');
    });
    this.els.logEar.addEventListener('click', function(){
      self.els.logPanel.classList.toggle('hidden');
    });
    this.els.logClearBtn.addEventListener('click', function(){
      self.els.logList.innerHTML = '';
      self.logCount = 0;
    });

    this.els.debugToggle.addEventListener('change', function(){
      self.setDebugUi(self.els.debugToggle.checked);
    });

    this.els.uiToggle.addEventListener('click', function(){
      var hidden = document.body.classList.toggle('ui-hidden');
      self.els.uiToggle.textContent = hidden ? 'UI+' : 'UI';
    });

    if (this.settings.uiHiddenInitially) {
      document.body.classList.add('ui-hidden');
      this.els.uiToggle.textContent = 'UI+';
    }
  }

  _hookConsole() {
    var self = this;
    ['log','warn','error'].forEach(function(level){
      var orig = console[level];
      console[level] = function(){
        self._logToPanel(level === 'log' ? 'info' : level, arguments);
        orig.apply(console, arguments);
      };
    });
    window.addEventListener('error', function(e){
      self._logToPanel('error', ['JS: ' + e.message]);
    });
  }

  _pad(n) { return n < 10 ? '0'+n : ''+n; }

  _timeStr() {
    var d = new Date();
    return this._pad(d.getHours())+':'+this._pad(d.getMinutes())+':'+this._pad(d.getSeconds());
  }

  _stringifyArg(a) {
    if (a instanceof Error) return a.message;
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch(e) { return String(a); }
    }
    return String(a);
  }

  _logToPanel(level, args) {
    this.logCount++;
    var line = document.createElement('div');
    line.className = 'entry';
    var msg = Array.prototype.map.call(args, this._stringifyArg).join(' ');
    line.innerHTML = '<span class="t">['+this._timeStr()+']</span> <span class="lvl-'+level+'">'+
            msg.replace(/</g,'&lt;') + '</span>';
    this.els.logList.appendChild(line);
    this.els.logList.scrollTop = this.els.logList.scrollHeight;
    var maxEntries = this.settings.maxLogEntries || 200;
    if (this.logCount > maxEntries) { this.els.logList.removeChild(this.els.logList.firstChild); }
  }

  setStatus(found) {
    if (found) {
      this.els.statusPill.classList.add('found');
      this.els.statusText.textContent = 'найден';
      this.els.markerFrame.classList.add('found');
    } else {
      this.els.statusPill.classList.remove('found');
      this.els.statusText.textContent = 'поиск…';
      this.els.markerFrame.classList.remove('found');
    }
  }

  setDiag(text, isError) {
    this.els.diagStatus.textContent = text;
    this.els.diagStatus.style.color = isError ? 'var(--danger)' : 'var(--accent)';
  }

  hideLoader() {
    this.els.loader.style.display = 'none';
  }

  setDebugUi(on) {
    document.body.classList.toggle('show-arjs-debug', !!on);
    this.els.debugToggle.checked = !!on;
    this.els.debugChip.classList.toggle('on', !!on);
    this.els.markerFrame.classList.toggle('on', !!on);
    this._pinArjsDebugCanvas();
  }

  _pinArjsDebugCanvas() {
    var show = document.body.classList.contains('show-arjs-debug');
    var list = document.querySelectorAll('canvas');
    var found = 0;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.classList.contains('a-canvas')) continue;
      if (c.parentElement && c.parentElement.closest && c.parentElement.closest('a-scene')) continue;
      try {
        if (c.getContext && (c.getContext('webgl') || c.getContext('webgl2'))) continue;
      } catch(e) {}
      c.classList.add('arjs-debug-ui');
      c.style.cssText = [
        'position:fixed','top:8px','left:8px','width:160px','height:120px',
        'z-index:80','border:1px solid #2f7a58','border-radius:6px',
        'background:#000','display:'+(show?'block':'none'),
        'object-fit:contain','pointer-events:none'
      ].join(' !important;') + ' !important;';
      found++;
    }
    if (found && !this._debugLogged) {
      this._debugLogged = true;
      console.log('AR.js debug canvas: ' + found);
    }
  }

  startDebugCanvasWatcher() {
    var self = this;
    var delays = this.settings.debugCanvasWatcherDelaysMs || [400, 1000, 2000, 4000, 8000];
    delays.forEach(function(ms){
      setTimeout(function(){ self._pinArjsDebugCanvas(); }, ms);
    });
    if (window.MutationObserver) {
      new MutationObserver(function(muts){
        for (var i = 0; i < muts.length; i++) {
          var nodes = muts[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            if (nodes[j] && nodes[j].nodeName === 'CANVAS') {
              self._pinArjsDebugCanvas();
              return;
            }
          }
        }
      }).observe(document.body, {childList:true, subtree:true});
    }
  }
}