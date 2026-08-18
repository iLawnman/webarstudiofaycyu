/** Панели: рендер на canvas, парсинг HTML, prop-панели из JSON */

import { normalizePath, escapeAttr, decodeHtmlB64 } from './utils.js';

export const DESIGN_PROP_KEYS = ['font', 'color', 'image', 'fx', 'sound', 'text', 'prefab'];

export function buildPropPanelVisual(props) {
    const panelData = { bgColor: '#181830', borderColor: '#4a5568', elements: [], props };

    if (props.color) {
        const c = String(props.color).replace('#', '');
        panelData.bgColor = /^[0-9a-fA-F]{6,8}$/.test(c) ? '#' + c.slice(0, 6) : panelData.bgColor;
    }

    let y = 26;
    panelData.elements.push({ type: 'text', text: props.group || '', y, fontSize: 17, fontWeight: 'bold', color: '#ffd700' });
    y += 26;

    if (props.image) {
        panelData.elements.push({ type: 'text', text: '[IMG] ' + String(props.image).split('/').pop(), y, fontSize: 13, color: '#7dd3fc' });
        y += 20;
    }
    if (props.text) {
        panelData.elements.push({ type: 'text', text: props.text, y, fontSize: 15, color: '#ffffff' });
        y += 20;
    }
    if (props.font) {
        panelData.elements.push({ type: 'text', text: 'Font: ' + props.font, y, fontSize: 12, color: '#94a3b8' });
        y += 16;
    }
    if (props.fx) {
        panelData.elements.push({ type: 'text', text: 'FX: ' + props.fx, y, fontSize: 12, color: '#94a3b8' });
        y += 16;
    }
    if (props.sound) {
        panelData.elements.push({ type: 'text', text: 'Sound: ' + props.sound, y, fontSize: 12, color: '#94a3b8' });
        y += 16;
    }
    if (props.prefab) {
        panelData.elements.push({ type: 'text', text: 'Prefab: ' + props.prefab, y, fontSize: 12, color: '#94a3b8' });
        y += 16;
    }

    return panelData;
}

export function serializePropPanelDiv(props) {
    let attrs = `class="panel prop-panel" data-group="${escapeAttr(props.group || '')}"`;
    DESIGN_PROP_KEYS.forEach(k => {
        if (props[k]) attrs += ` data-${k}="${escapeAttr(props[k])}"`;
    });
    return `<div ${attrs}></div>`;
}

export function drawVideoPlaceholder(ctx, w, el) {
    const ew = el.width || (w - 40);
    const eh = el.height || 120;
    const ex = (w - ew) / 2;
    const ey = el.y || 100;

    ctx.fillStyle = '#000';
    ctx.fillRect(ex, ey, ew, eh);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex, ey, ew, eh);

    const cx = ex + ew / 2;
    const cy = ey + eh / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 24);
    ctx.lineTo(cx - 18, cy + 24);
    ctx.lineTo(cx + 26, cy);
    ctx.closePath();
    ctx.fill();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(el.label || el.src || 'Video', cx, ey + eh + 22);
}

export function drawHtmlBlockAsync(ctx, el, texture) {
    const ew = el.width || 220;
    const eh = el.height || 150;
    const ex = el.x || (256 - ew) / 2;
    const ey = el.y || 100;
    const html = el.html || '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ew}" height="${eh}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${ew}px;height:${eh}px;overflow:hidden;">${html}</div>
      </foreignObject>
    </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, ex, ey, ew, eh);
        URL.revokeObjectURL(url);
        texture.needsUpdate = true;
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}

export function renderPanelToCanvas(panelData) {
    const canvas = document.getElementById('render-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = panelData.bgColor || '#0a0a1e';
    ctx.fillRect(0, 0, w, h);

    if (panelData.borderColor) {
        ctx.strokeStyle = panelData.borderColor;
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
    }

    const texture = new THREE.CanvasTexture(canvas);

    if (panelData.elements) {
        panelData.elements.forEach(el => {
            ctx.fillStyle = el.color || '#ffffff';
            ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize || 20}px sans-serif`;
            ctx.textAlign = 'center';

            if (el.type === 'text' || el.type === 'label') {
                ctx.fillText(el.text || '', w / 2, el.y || 50);
            } else if (el.type === 'button') {
                ctx.fillStyle = el.btnBg || '#00cc66';
                ctx.fillRect(20, el.y - 30, w - 40, 50);
                ctx.fillStyle = el.color || '#ffffff';
                ctx.fillText(el.text || 'Button', w / 2, el.y + 5);
            } else if (el.type === 'input') {
                ctx.strokeStyle = '#666';
                ctx.strokeRect(20, el.y - 20, w - 40, 40);
                ctx.fillStyle = '#aaa';
                ctx.fillText(el.text || 'Input...', w / 2, el.y + 5);
            } else if (el.type === 'video') {
                drawVideoPlaceholder(ctx, w, el);
            } else if (el.type === 'html') {
                drawHtmlBlockAsync(ctx, el, texture);
            }
        });
    }

    texture.needsUpdate = true;
    return texture;
}

export function parsePanelHTML(html) {
    const panelData = { bgColor: '#0a0a30', borderColor: '#00ffaa', elements: [] };
    if (!html) return panelData;

    if (html.includes('prop-panel')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const el = doc.querySelector('.prop-panel');
        const props = {};
        if (el) {
            for (const attr of Array.from(el.attributes)) {
                if (attr.name.startsWith('data-')) {
                    const key = attr.name.slice(5);
                    props[key] = attr.value;
                }
            }
        }
        return buildPropPanelVisual(props);
    }

    if (html.includes('artarget-root')) {
        panelData.bgColor = '#141428';
        panelData.borderColor = '#FFD700';

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const groups = doc.querySelectorAll('.panel-group');

        let currentY = 30;
        groups.forEach(group => {
            const groupName = group.getAttribute('data-name') || '';

            const img = group.querySelector('img.panel-image');
            if (img) {
                const src = img.getAttribute('src');
                const imgColor = img.getAttribute('data-color') || '';
                const imgFx = img.getAttribute('data-fx') || '';
                let imgDetails = `[IMG: ${src}]`;
                if (imgColor) imgDetails += ` (Color: #${imgColor})`;
                if (imgFx) imgDetails += ` (FX: ${imgFx})`;

                panelData.elements.push({
                    type: 'text',
                    text: imgDetails,
                    y: currentY,
                    fontSize: 14,
                    color: '#888888'
                });
                currentY += 20;
            }

            const textBlock = group.querySelector('.panel-text-block');
            if (textBlock) {
                const color = textBlock.getAttribute('data-color') || '#ffffff';
                const fx = textBlock.getAttribute('data-fx') || '';
                const textSpan = textBlock.querySelector('.label-text');
                const labelText = textSpan ? textSpan.textContent : '';

                let displayStr = `${groupName}: ${labelText}`;
                if (fx) displayStr += ` (FX: ${fx})`;

                panelData.elements.push({
                    type: 'text',
                    text: displayStr,
                    y: currentY,
                    fontSize: 16,
                    color: color.startsWith('#') ? color : '#' + color
                });
                currentY += 24;
            }

            currentY += 10;
        });
        return panelData;
    }

    if (html.includes('img-panel')) {
        panelData.bgColor = '#1a0033';
        panelData.borderColor = '#ff66cc';
    } else if (html.includes('ok-panel')) {
        panelData.bgColor = '#002814';
        panelData.borderColor = null;
    }

    const labelMatch = html.match(/class="label">([^<]+)</);
    if (labelMatch) panelData.elements.push({ type: 'text', text: labelMatch[1], y: 40, fontSize: 24, color: panelData.borderColor });

    const nameMatch = html.match(/class="name">([^<]+)</);
    if (nameMatch) panelData.elements.push({ type: 'text', text: nameMatch[1], y: 160, fontSize: 32, fontWeight: 'bold' });

    const subMatch = html.match(/class="sub">([^<]+)</);
    if (subMatch) panelData.elements.push({ type: 'text', text: subMatch[1], y: 250, fontSize: 20, color: '#aaa' });

    const btnMatch = html.match(/class="btn">([^<]+)</);
    if (btnMatch) panelData.elements.push({ type: 'button', text: btnMatch[1], y: 480, fontSize: 32, btnBg: '#00cc66' });

    const videoMatch = html.match(/<video[^>]*data-src="([^"]*)"[^>]*data-y="([^"]*)"[^>]*>/);
    if (videoMatch) {
        panelData.elements.push({ type: 'video', src: normalizePath(videoMatch[1]), label: 'Video', y: parseFloat(videoMatch[2]) || 150, width: 200, height: 120 });
    }

    const htmlBlockRegex = /<div class="html-block" data-raw-b64="([^"]*)" data-y="([^"]*)"[^>]*><\/div>/g;
    let hbMatch;
    while ((hbMatch = htmlBlockRegex.exec(html)) !== null) {
        panelData.elements.push({ type: 'html', html: decodeHtmlB64(hbMatch[1]), y: parseFloat(hbMatch[2]) || 100, width: 220, height: 150 });
    }

    return panelData;
}

export function refreshPanelTexture(obj) {
    const texture = renderPanelToCanvas(obj.userData.panelData);
    obj.material.map = texture;
    obj.material.needsUpdate = true;
}