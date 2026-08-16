// recognitionmodule.js — подписка на события маркера AR.js

export class RecognitionModule {
  constructor(settings) {
    this.cfg = settings;
    this.marker = null;
    this._handlers = { found: [], lost: [] };
  }

  /**
   * Привязать модуль к DOM-элементу <a-marker>.
   * Подписывается на markerFound / markerLost.
   */
  attach(markerElement) {
    this.marker = markerElement;
    if (!this.marker) {
      console.warn('RecognitionModule: marker element не предоставлен');
      return this;
    }

    const { found, lost } = this.cfg.ar.markerEvents;

    this.marker.addEventListener(found, (e) => this._emit('found', e));
    this.marker.addEventListener(lost, (e) => this._emit('lost', e));

    return this;
  }

  on(event, callback) {
    if (this._handlers[event]) {
      this._handlers[event].push(callback);
    }
    return this;
  }

  off(event, callback) {
    if (this._handlers[event]) {
      this._handlers[event] = this._handlers[event].filter(cb => cb !== callback);
    }
    return this;
  }

  _emit(event, detail) {
    this._handlers[event].forEach(cb => {
      try {
        cb(detail);
      } catch (err) {
        console.error('RecognitionModule callback error:', err);
      }
    });
  }
}
