// js/artarget.js
import * as THREE from 'three';

/**
 * Composite AR target:
 * - central sphere (r=0.01)
 * - left vertical panel  — text with marker name
 * - right vertical panel — image placeholder
 * - bottom panel         — OK button
 *
 * WebXR imageSpace: image in XY, +Z normal out of image.
 * PlaneGeometry is XY → flat on marker; rotation.x = -π/2 stands panels up.
 */
export function createArTarget(markerName = 'T1', options = {}) {
    const { onOk = null } = options;

    const group = new THREE.Group();
    group.name = `arTarget_${markerName}`;

    // --- central sphere ---
    const sphereGeo = new THREE.SphereGeometry(0.01, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        metalness: 0.3,
        roughness: 0.4,
        emissive: 0xff00ff,
        emissiveIntensity: 0.15
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);

    const panelW = 0.12;
    const panelH = 0.18;
    const panelOffset = 0.12;

    // --- left panel: text ---
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 256;
    textCanvas.height = 384;
    const tctx = textCanvas.getContext('2d');

    tctx.fillStyle = 'rgba(10, 10, 30, 0.92)';
    tctx.fillRect(0, 0, 256, 384);

    tctx.strokeStyle = '#00ffaa';
    tctx.lineWidth = 8;
    tctx.strokeRect(4, 4, 248, 376);

    tctx.fillStyle = '#00ffaa';
    tctx.font = 'bold 28px sans-serif';
    tctx.textAlign = 'center';
    tctx.fillText('MARKER', 128, 60);

    tctx.fillStyle = '#ffffff';
    tctx.font = 'bold 36px sans-serif';
    tctx.fillText(String(markerName), 128, 200);

    tctx.fillStyle = '#aaaaaa';
    tctx.font = '20px sans-serif';
    tctx.fillText('AR Target', 128, 280);

    const textTex = new THREE.CanvasTexture(textCanvas);
    textTex.colorSpace = THREE.SRGBColorSpace;
    textTex.needsUpdate = true;

    const textPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({
            map: textTex,
            transparent: true,
            side: THREE.DoubleSide
        })
    );
    textPanel.position.set(-panelOffset, 0, 0.02);
    textPanel.rotation.x = -Math.PI / 2;
    group.add(textPanel);

    // --- right panel: image placeholder ---
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = 256;
    imgCanvas.height = 384;
    const ictx = imgCanvas.getContext('2d');

    const grad = ictx.createLinearGradient(0, 0, 0, 384);
    grad.addColorStop(0, '#1a0033');
    grad.addColorStop(1, '#003344');
    ictx.fillStyle = grad;
    ictx.fillRect(0, 0, 256, 384);

    for (let i = 0; i < 12; i++) {
        ictx.beginPath();
        ictx.arc(
            40 + Math.random() * 176,
            40 + Math.random() * 304,
            8 + Math.random() * 24,
            0,
            Math.PI * 2
        );
        ictx.fillStyle = `hsla(${200 + Math.random() * 80}, 70%, 55%, 0.7)`;
        ictx.fill();
    }

    ictx.strokeStyle = '#ff66cc';
    ictx.lineWidth = 8;
    ictx.strokeRect(4, 4, 248, 376);

    ictx.fillStyle = '#ff66cc';
    ictx.font = 'bold 22px sans-serif';
    ictx.textAlign = 'center';
    ictx.fillText('IMAGE', 128, 50);

    ictx.fillStyle = '#ffffff';
    ictx.font = '18px sans-serif';
    ictx.fillText(String(markerName), 128, 340);

    const imgTex = new THREE.CanvasTexture(imgCanvas);
    imgTex.colorSpace = THREE.SRGBColorSpace;
    imgTex.needsUpdate = true;

    const imgPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({
            map: imgTex,
            transparent: true,
            side: THREE.DoubleSide
        })
    );
    imgPanel.position.set(panelOffset, 0, 0.02);
    imgPanel.rotation.x = -Math.PI / 2;
    group.add(imgPanel);

    // --- bottom panel: OK button ---
    const okW = 0.16;
    const okH = 0.06;
    const okCanvas = document.createElement('canvas');
    okCanvas.width = 256;
    okCanvas.height = 96;
    const octx = okCanvas.getContext('2d');

    octx.fillStyle = 'rgba(0, 40, 20, 0.95)';
    octx.fillRect(0, 0, 256, 96);

    octx.fillStyle = '#00cc66';
    octx.beginPath();
    roundRect(octx, 24, 16, 208, 64, 12);
    octx.fill();

    octx.strokeStyle = '#00ff99';
    octx.lineWidth = 4;
    octx.stroke();

    octx.fillStyle = '#ffffff';
    octx.font = 'bold 40px sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText('OK', 128, 48);

    const okTex = new THREE.CanvasTexture(okCanvas);
    okTex.colorSpace = THREE.SRGBColorSpace;
    okTex.needsUpdate = true;

    const okPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(okW, okH),
        new THREE.MeshBasicMaterial({
            map: okTex,
            transparent: true,
            side: THREE.DoubleSide
        })
    );
    okPanel.position.set(0, -0.14, 0.02);
    okPanel.rotation.x = -Math.PI / 2;
    okPanel.name = 'okButton';
    group.add(okPanel);

    group.position.z = 0.02;

    group.userData = {
        markerName,
        sphere,
        textPanel,
        imgPanel,
        okPanel,
        textTexture: textTex,
        imgTexture: imgTex,
        okTexture: okTex,
        onOk
    };

    return group;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}