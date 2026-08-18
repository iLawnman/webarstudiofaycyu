import * as THREE from 'three';

const DEFAULT_TEMPLATE_URL = '/assets/artarget.html';

/**
 * ModelFactory — central builder for AR target objects.
 * HTML templates remain the single source of truth for panel content, size and placement.
 * Procedural (canvas) fallback is available for offline / no-foreignObject environments.
 */
export class ModelFactory {
    /**
     * @param {object} [defaults]
     * @param {string} [defaults.templateUrl]
     */
    constructor(defaults = {}) {
        this.templateUrl = defaults.templateUrl || DEFAULT_TEMPLATE_URL;
    }

    /**
     * Abstract AR object: panels + layout come from declarative HTML.
     * @param {string|object} [targetData=''] Target identifier or data object
     * @param {object} [options]
     * @param {Function|null} [options.onOk]
     * @param {string} [options.templateUrl]
     * @param {object} [options.vars] Additional variables for template substitution
     * @returns {Promise<THREE.Group>}
     */
    async createArTarget(targetData = '', options = {}) {
        const { onOk = null, templateUrl = this.templateUrl, vars: extraVars = {} } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const groupName = targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const template = await this._loadTemplate(templateUrl);
        const panels = template.querySelectorAll('panel');

        // Генерируем HTML содержимого оверлей-панели для подстановки в шаблон
        const imageSrc = extraVars.imageSrc || targetInfo.imageSrc || '';
        const imageHtml = imageSrc ? `<img class="panel-img" src="${imageSrc}" alt="target" />` : '';
        const questionText = extraVars.question || targetInfo.question || title || '';
        const bodyHtml = this._buildQuestionBodyHtml(extraVars);

        const templateVars = {
            title: title,
            textLabel: targetInfo.textLabel ?? 'MARKER',
            imgLabel: targetInfo.imgLabel ?? 'IMAGE',
            subtitle: targetInfo.subtitle ?? 'AR Target',
            okText: targetInfo.okText ?? 'OK',
            markerName: title,
            imageHtml: imageHtml,
            question: questionText,
            bodyHtml: bodyHtml,
            ...extraVars
        };

        const userData = {
            targetInfo,
            markerName: title,
            sphere,
            onOk,
            panels: {}
        };

        for (const panelEl of panels) {
            const mesh = await this._createPanelFromHtml(panelEl, templateVars);
            group.add(mesh);
            userData.panels[mesh.name] = mesh;
            userData[mesh.name] = mesh; // legacy direct access
            if (mesh.userData.texture) {
                userData[`${mesh.name}Texture`] = mesh.userData.texture;
            }
        }

        group.position.z = 0.02;
        group.userData = userData;

        return group;
    }

    /**
     * Pure-canvas fallback (no network / no foreignObject) — for offline use.
     * @param {string|object} [targetData=''] Target identifier or data object
     * @param {object} [options]
     * @param {Function|null} [options.onOk]
     * @returns {THREE.Group}
     */
    createArTargetSync(targetData = '', options = {}) {
        const { onOk = null } = options;

        const targetInfo = typeof targetData === 'object' && targetData !== null
            ? targetData
            : { title: String(targetData) };

        const title = targetInfo.title ?? targetInfo.name ?? String(targetData ?? '');
        const questionText = options.vars?.question || targetInfo.question || title || 'AR Target';
        const okText = targetInfo.okText ?? 'OK';
        const groupName = targetInfo.id || title || 'target';

        const group = new THREE.Group();
        group.name = `arTarget_${groupName}`;

        const sphere = this._createSphere();
        group.add(sphere);

        const questionPanel = this._makeCanvasPanel({
            name: 'questionPanel',
            w: 0.24, h: 0.30,
            pos: [0, 0, 0.02],
            rot: [-Math.PI / 2, 0, 0],
            canvasW: 380, canvasH: 480,
            draw: (ctx, cw, ch) => {
                ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
                ctx.fillRect(0, 0, cw, ch);
                ctx.strokeStyle = '#00ffaa';
                ctx.lineWidth = 6;
                ctx.strokeRect(4, 4, cw - 8, ch - 8);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(title, cw / 2, 60);

                ctx.fillStyle = '#00ffaa';
                ctx.font = '20px sans-serif';
                ctx.fillText(questionText, cw / 2, 140);

                ctx.fillStyle = 'rgba(0, 40, 20, 0.95)';
                ctx.fillRect(cw / 4, ch - 90, cw / 2, 50);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(okText, cw / 2, ch - 65);
            }
        });
        group.add(questionPanel);

        group.position.z = 0.02;
        group.userData = {
            targetInfo,
            markerName: title,
            sphere,
            questionPanel,
            questionTexture: questionPanel.userData.texture,
            onOk
        };
        return group;
    }

    _buildQuestionBodyHtml(vars = {}) {
        const type = vars.answerType || 'Slide';
        const options = vars.options || [];

        if (type === 'Button') {
            const btns = options.map((opt, idx) => 
                `<div class="quest-btn">${opt.text || `Вариант ${idx + 1}`}</div>`
            ).join('');
            return `<div class="quest-options-grid">${btns}</div>`;
        } else if (type === 'InputField') {
            const val = vars.inputValue || '';
            return `
                <div class="quest-input-block">
                    <div class="quest-input">${val || 'Введите ответ...'}</div>
                    <div class="quest-submit-btn">OK</div>
                </div>`;
        } else if (type === 'Art' || type === 'AntiArt') {
            return `<div class="quest-submit-btn quest-ok-btn">OK</div>`;
        } else {
            const currentSlideText = options[vars.activeSlideIndex || 0]?.text || vars.mainText || '';
            return `
                <div class="quest-slider">
                    <div class="slide-nav">◄</div>
                    <div class="slide-content">${currentSlideText}</div>
                    <div class="slide-nav">►</div>
                </div>
                <div class="quest-submit-btn quest-ok-btn" style="margin-top: 10px;">OK</div>`;
        }
    }

    // ─── private: HTML → THREE ─────────────────────────────────────────────────

    async _loadTemplate(url) {
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#ar-target') || doc.querySelector('template');
        if (!template) throw new Error(`No <template id="ar-target"> in ${url}`);

        const styleEl = doc.querySelector('style');
        if (styleEl) {
            template.dataset.style = styleEl.textContent;
        }
        return template;
    }

    async _createPanelFromHtml(panelEl, vars = {}) {
        const name = panelEl.getAttribute('name') || 'panel';
        const w = parseFloat(panelEl.dataset.width) || 0.24;
        const h = parseFloat(panelEl.dataset.height) || 0.30;
        const pos = this._parseVec3(panelEl.dataset.position, [0, 0, 0.02]);
        const rot = this._parseVec3(panelEl.dataset.rotation, [-90, 0, 0]).map(d => d * Math.PI / 180);

        let inner = panelEl.innerHTML;
        for (const [k, v] of Object.entries(vars)) {
            inner = inner.replaceAll(`{{${k}}}`, String(v ?? ''));
        }

        const { cssW, cssH } = this._measurePanelCss(panelEl);

        const texture = await this._htmlToTexture(
            inner,
            cssW,
            cssH,
            panelEl.closest('template')?.dataset?.style || ''
        );

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            })
        );
        mesh.name = name;
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.userData.texture = texture;

        return mesh;
    }

    _measurePanelCss(panelEl) {
        const root = panelEl.querySelector('.panel') || panelEl.firstElementChild;
        if (!root) return { cssW: 380, cssH: 480 };

        const style = root.getAttribute('style') || '';
        const wMatch = style.match(/width:\s*([\d.]+)px/);
        const hMatch = style.match(/height:\s*([\d.]+)px/);

        let cssW = wMatch ? parseFloat(wMatch[1]) : 380;
        let cssH = hMatch ? parseFloat(hMatch[1]) : 480;

        return { cssW, cssH };
    }

    _htmlToTexture(html, width, height, cssText = '') {
        return new Promise((resolve, reject) => {
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">
      <style>${cssText}</style>
      ${html}
    </div>
  </foreignObject>
</svg>`.trim();

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const tex = new THREE.CanvasTexture(canvas);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.needsUpdate = true;
                resolve(tex);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    // ─── private: helpers ──────────────────────────────────────────────────────

    _createSphere() {
        const geo = new THREE.SphereGeometry(0.01, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0xff00ff,
            emissiveIntensity: 0.15
        });
        return new THREE.Mesh(geo, mat);
    }

    _parseVec3(str, fallback) {
        if (!str) return fallback.slice();
        const parts = str.split(',').map(s => parseFloat(s.trim()));
        return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback.slice();
    }

    _makeCanvasPanel({ name, w, h, pos, rotX, rot = [rotX ?? -Math.PI / 2, 0, 0], canvasW = 380, canvasH = 480, draw }) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        draw(ctx, canvasW, canvasH);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        mesh.name = name;
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.userData.texture = tex;
        return mesh;
    }
}

const defaultFactory = new ModelFactory();

export async function createArTarget(targetData, options = {}) {
    return defaultFactory.createArTarget(targetData, options);
}

export function createArTargetSync(targetData, options = {}) {
    return defaultFactory.createArTargetSync(targetData, options);
}