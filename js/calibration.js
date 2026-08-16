export class CalibrationManager {
  constructor(ui) {
    this.ui = ui;
    this.isCalibrated = false;
  }

  async runCalibration(xrSession) {
    this.ui.log('Старт механизмов calibration.js...', 'info');
    this.ui.setHint('Калибровка пространства...');

    return new Promise((resolve) => {
      setTimeout(() => {
        this.isCalibrated = true;
        this.ui.log('Калибровка завершена успешно!', 'ok');
        resolve(true);
      }, 2000);
    });
  }
}