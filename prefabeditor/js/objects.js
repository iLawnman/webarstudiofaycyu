/** Создание 3D-объектов: model, panel, video, html */

import { normalizePath, applyTransformData } from './utils.js';
import { parsePanelHTML, renderPanelToCanvas, drawVideoPlaceholder, drawHtmlBlockAsync } from './panels.js';

const objLoader = new THREE.OBJLoader();

export function createObjectMesh(data = {}) {
    const group = new THREE.Group();
    group.name = data.name || 'object_' + Date.now().toString().slice(-4);
    const srcPath = normalizePath(data.src || '');
    group.userData = { type: 'object3d', rawData: data, src: srcPath };

    const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x666666, wireframe: true })
    );
    placeholder.name = 'placeholder';
    group.add(placeholder);

    applyTransformData(group, data);
    if (srcPath) loadObjIntoGroup(group, srcPath, placeholder);
    return group;
}

function loadObjIntoGroup(group, src, placeholder) {
    const path = normalizePath(src);
    objLoader.load(path, obj => {
        if (placeholder && placeholder.parent === group) group.remove(placeholder);
        obj.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.2, roughness: 0.6 });
            }
        });
        group.add(obj);
        group.userData.loadedObj = obj;
    }, undefined, err => {
        console.error('Не удалось загрузить OBJ:', path, err);
    });
}

export function reloadObjectModel(group) {
    if (group.userData.loadedObj) {
        group.remove(group.userData.loadedObj);
        group.userData.loadedObj = null;
    }
    const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x666666, wireframe: true })
    );
    placeholder.name = 'placeholder';
    group.add(placeholder);
    if (group.userData.src) loadObjIntoGroup(group, group.userData.src, placeholder);
}

export function createVideoMesh(data = {}) {
    const width = parseFloat(data.width) || 0.2;
    const height = parseFloat(data.height) || 0.12;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);

    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = data.name || 'video_' + Date.now().toString().slice(-4);
    mesh.userData = {
        type: 'video', rawData: data,
        src: normalizePath(data.src || ''), label: data.label || 'Video',
        width, height, canvas, ctx, texture
    };

    applyTransformData(mesh, data);
    refreshVideoTexture(mesh);
    return mesh;
}

export function refreshVideoTexture(mesh) {
    const { canvas, ctx } = mesh.userData;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawVideoPlaceholder(ctx, canvas.width, {
        width: canvas.width - 32, height: canvas.height - 60, y: 12,
        label: mesh.userData.label, src: mesh.userData.src
    });
    mesh.userData.texture.needsUpdate = true;
}

export function createHtmlMesh(data = {}, rawHtml = '') {
    const width = parseFloat(data.width) || 0.2;
    const height = parseFloat(data.height) || 0.14;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);

    const html = rawHtml || data.html || '<div style="color:#fff;padding:8px;">Custom HTML</div>';

    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = data.name || 'html_' + Date.now().toString().slice(-4);
    mesh.userData = { type: 'html', rawData: data, html, width, height, canvas, ctx, texture };

    applyTransformData(mesh, data);
    refreshHtmlTexture(mesh);
    return mesh;
}

export function refreshHtmlTexture(mesh) {
    const { canvas, ctx, html, texture } = mesh.userData;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawHtmlBlockAsync(ctx, { html, x: 8, y: 8, width: canvas.width - 16, height: canvas.height - 16 }, texture);
}

export function createPanelMesh(data = {}, innerHTML = '') {
    const width = parseFloat(data.width) || 0.3;
    const height = parseFloat(data.height) || 0.3;
    const geo = new THREE.PlaneGeometry(width, height);

    const panelData = parsePanelHTML(innerHTML);
    const texture = renderPanelToCanvas(panelData);

    const mat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = data.name || 'panel_' + Date.now().toString().slice(-4);
    mesh.userData = {
        type: 'panel',
        rawData: data,
        panelData: panelData,
        innerHTML: innerHTML,
        width,
        height
    };

    applyTransformData(mesh, data);
    return mesh;
}

export function rebuildPlaneGeometry(mesh) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(mesh.userData.width, mesh.userData.height);
}