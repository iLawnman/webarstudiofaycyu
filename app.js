// app.js — тонкий оркестратор: инициализация модулей и связывание событий

import settings from './settings.json' assert { type: 'json' };
import { UIModule } from './uimodule.js';
import { ARSceneModule } from './arscenemodule.js';
import { RecognitionModule } from './recognitionmodule.js';

class App {
  constructor() {
    this.ui = new UIModule(settings);
    this.ar = new ARSceneModule(settings);
    this.recognition = new RecognitionModule(settings);
  }

  async init() {
    try {
      // 1. UI готов
      this.ui.init();
      this.ui.showLoader();

      // 2. Сцена загружена
      await this.ar.init();
      this.ui.log('AR scene ready');

      // 3. Распознавание
      this.recognition
        .attach(this.ar.getMarker())
        .on('found', (e) => this.onMarkerFound(e))
        .on('lost', (e) => this.onMarkerLost(e));

      this.ui.hideLoader();
      this.ui.log('App initialized');
    } catch (err) {
      console.error('[App] init error:', err);
      this.ui.log(`Ошибка инициализации: ${err.message}`);
    }
  }

  onMarkerFound(event) {
    this.ui.setStatus('found');
    this.ui.log('Marker FOUND');
    // Можно активировать/деактивировать объекты сцены по необходимости
    this.ar.setGroundPlaneVisible(true);
  }

  onMarkerLost(event) {
    this.ui.setStatus('lost');
    this.ui.log('Marker LOST');
  }
}

// Старт
const app = new App();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
