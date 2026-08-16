/* ============================================================
   app.js — тонкий оркестратор
   ============================================================ */
import { UIController } from './ui-controller.js';
import { ArSceneController } from './ar-scene-controller.js';
import { RecoController } from './reco-controller.js';

async function main() {
  var settings = {};
  try {
    var res = await fetch('./settings.json', { cache: 'no-store' });
    if (res.ok) {
      settings = await res.json();
      console.log('[app] settings loaded');
    } else {
      console.warn('[app] settings.json HTTP ' + res.status + ', using defaults');
    }
  } catch (e) {
    console.warn('[app] settings.json not loaded, using defaults', e.message);
  }

  var ui    = new UIController(settings.ui);
  var scene = new ArSceneController(ui, { ...settings.scene, timers: settings.timers });
  var reco  = new RecoController(ui, scene, settings.ar);

  ui.init();
  ui.startDebugCanvasWatcher();
  scene.init();
  reco.init();
}

main().catch(function(err){
  console.error('[app] bootstrap failed', err);
});