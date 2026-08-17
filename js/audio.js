// js/audio.js

const SOUND_MAP = {
    click: './assets/click.mp3',
};

let audioCtx = null;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }

    return audioCtx;
}

/**
 * Fallback click generated through Web Audio API.
 */
function playGeneratedClick() {
    try {
        const ctx = getCtx();
        const t0 = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1800, t0);
        osc.frequency.exponentialRampToValueAtTime(400, t0 + 0.04);

        gain.gain.setValueAtTime(0.22, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t0);
        osc.stop(t0 + 0.06);
    } catch (error) {
        console.warn('[Audio] Failed to generate fallback click:', error);
    }
}

/**
 * Check that an audio asset actually exists before trying to play it.
 */
async function assetExists(src) {
    try {
        const response = await fetch(src, {
            method: 'HEAD',
            cache: 'no-store'
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Play sound by key.
 *
 * Asset convention:
 *   /assets/<key>.mp3
 *
 * If the asset does not exist, generated click is used as fallback.
 */
export async function playSound(soundKey) {
    if (!soundKey) {
        console.warn('[Audio] Empty sound key');
        playGeneratedClick();
        return;
    }

    const src = SOUND_MAP[soundKey] || `/assets/${soundKey}.mp3`;

    if (!(await assetExists(src))) {
        console.warn(
            `[Audio] Sound "${soundKey}" not found: ${src}. Using generated click fallback.`
        );

        playGeneratedClick();
        return;
    }

    try {
        const audio = new Audio(src);
        audio.volume = 0.6;

        await audio.play();
    } catch (error) {
        console.warn(
            `[Audio] Failed to play "${soundKey}" from ${src}. Using generated click fallback.`,
            error
        );

        playGeneratedClick();
    }
}

/**
 * Wire pointer interactions to the click sound.
 * pointerdown covers mouse, touch and pen.
 */
export function enableClickSounds() {
    const handler = () => {
        playSound('click');
    };

    document.addEventListener('pointerdown', handler, {
        passive: true
    });
}

// Auto-enable
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            enableClickSounds
        );
    } else {
        enableClickSounds();
    }
}