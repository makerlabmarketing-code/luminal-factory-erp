import type { HomepageHeroPresentationSettings } from './contracts';

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function buildPreviewDocument(
  modelUrl: string,
  settings: HomepageHeroPresentationSettings,
) {
  const autoRotate = settings.autoRotate ? ' auto-rotate' : '';
  const safeModelUrl = escapeHtmlAttribute(modelUrl);

  return [
    '<!doctype html>',
    '<html lang="vi"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    '<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js"><' + '/script>',
    '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020617;color:#cbd5e1;font-family:system-ui,sans-serif}model-viewer{width:100%;height:100%;background:radial-gradient(circle at 50% 45%,#172033 0%,#07101f 58%,#020617 100%)}.note{position:absolute;left:12px;bottom:10px;padding:6px 8px;border:1px solid #334155;border-radius:8px;background:#020617cc;font-size:11px}</style>',
    '</head><body>',
    '<model-viewer src="' + safeModelUrl + '" alt="Xem trước mô hình Hero" camera-controls disable-pan interaction-prompt="none" environment-image="neutral" orientation="0deg -52deg 0deg" camera-target="auto auto auto"',
    ' exposure="' + settings.exposure + '"',
    ' shadow-intensity="' + settings.shadowIntensity + '"',
    ' shadow-softness="' + settings.shadowSoftness + '"',
    ' camera-orbit="' + settings.cameraThetaDeg + 'deg ' + settings.cameraPhiDeg + 'deg ' + settings.cameraRadiusPercent + '%"',
    ' field-of-view="' + settings.cameraFieldOfViewDeg + 'deg"',
    ' min-camera-orbit="auto auto ' + settings.cameraMinRadiusPercent + '%"',
    ' max-camera-orbit="auto auto ' + settings.cameraMaxRadiusPercent + '%"',
    ' min-field-of-view="' + settings.cameraMinFieldOfViewDeg + 'deg"',
    ' max-field-of-view="' + settings.cameraMaxFieldOfViewDeg + 'deg"',
    ' rotation-per-second="' + settings.rotationPerSecondDeg + 'deg"',
    ' auto-rotate-delay="' + settings.autoRotateDelayMs + '"' + autoRotate + '></model-viewer>',
    '<script>' + previewRuntime(settings) + '<' + '/script>',
    '<div class="note">Xem trước quản trị · kéo để xoay 360° · cuộn để phóng to</div>',
    '</body></html>',
  ].join('');
}


function previewRuntime(settings: HomepageHeroPresentationSettings) {
  const initial = JSON.stringify(settings).replaceAll('<', '\\u003c');
  return `
    const viewer = document.querySelector('model-viewer');
    let settings = ${initial};
    const originalColors = new Map();
    function applySettings() {
      for (const [attribute, value] of [
        ['exposure', settings.exposure],
        ['shadow-intensity', settings.shadowIntensity],
        ['shadow-softness', settings.shadowSoftness],
        ['field-of-view', settings.cameraFieldOfViewDeg],
        ['min-field-of-view', settings.cameraMinFieldOfViewDeg],
        ['max-field-of-view', settings.cameraMaxFieldOfViewDeg],
        ['rotation-per-second', settings.rotationPerSecondDeg + 'deg'],
        ['auto-rotate-delay', settings.autoRotateDelayMs],
        ['camera-orbit', settings.cameraThetaDeg + 'deg ' + settings.cameraPhiDeg + 'deg ' + settings.cameraRadiusPercent + '%'],
        ['min-camera-orbit', 'auto auto ' + settings.cameraMinRadiusPercent + '%'],
        ['max-camera-orbit', 'auto auto ' + settings.cameraMaxRadiusPercent + '%'],
      ]) viewer.setAttribute(attribute, String(value));
      viewer.toggleAttribute('auto-rotate', settings.autoRotate === true);
      for (const material of viewer.model?.materials || []) {
        const pbr = material.pbrMetallicRoughness;
        // Match Commerce's modest highlight smoothing without changing GLB geometry.
        if (typeof pbr.roughnessFactor === 'number' && pbr.roughnessFactor < 0.42) {
          pbr.setRoughnessFactor?.(0.42);
        }
        if (!originalColors.has(material)) originalColors.set(material, [...pbr.baseColorFactor]);
        const original = originalColors.get(material);
        const tint = typeof settings.tint === 'string' && /^#[0-9a-f]{6}$/i.test(settings.tint) ? settings.tint : null;
        const color = tint ? [0, 1, 2].map((channel) => {
          const srgb = parseInt(tint.slice(1 + channel * 2, 3 + channel * 2), 16) / 255;
          return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
        }) : null;
        pbr.setBaseColorFactor(color ? [...color, original[3] ?? 1] : original);
      }
    }
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || event.data?.type !== 'hero-preview-settings' || !event.data.settings) return;
      settings = event.data.settings;
      applySettings();
    });
    viewer.addEventListener('load', () => {
      originalColors.clear();
      applySettings();
      window.parent.postMessage({ type: 'hero-preview-ready' }, '*');
    });
    viewer.addEventListener('error', () => window.parent.postMessage({ type: 'hero-preview-error' }, '*'));
    document.querySelector('script[type="module"]').addEventListener('error', () => window.parent.postMessage({ type: 'hero-preview-error' }, '*'));
    applySettings();
  `;
}
