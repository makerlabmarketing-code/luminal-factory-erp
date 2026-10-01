import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { buildPreviewDocument } from '../lib/commerce-admin/hero-preview';
import type { HomepageHeroPresentationSettings } from '../lib/commerce-admin/contracts';

const settings: HomepageHeroPresentationSettings = {
  tint: null, exposure: 1.08, shadowIntensity: 1, shadowSoftness: .72,
  autoRotate: false, autoRotateDelayMs: 700, rotationPerSecondDeg: 3,
  cameraThetaDeg: 12, cameraPhiDeg: 82, cameraRadiusPercent: 103,
  cameraIntroRadiusPercent: 103, cameraMinRadiusPercent: 78,
  cameraMaxRadiusPercent: 155, cameraFieldOfViewDeg: 29,
  cameraMinFieldOfViewDeg: 22, cameraMaxFieldOfViewDeg: 42,
};

function runtime() {
  const attributes = new Map<string, string>([['src', 'model.glb']]);
  const colors: Array<string | number[]> = [];
  const listeners = new Map<string, (event?: unknown) => void>();
  let receive: (event: { source: object; data: unknown }) => void = () => {};
  const parent = { postMessage() {} };
  const viewer = {
    model: { materials: [{ pbrMetallicRoughness: {
      baseColorFactor: [.2, .3, .4, .5],
      setBaseColorFactor: (color: string | number[]) => colors.push(color),
    } }] },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    toggleAttribute: (name: string, enabled: boolean) => enabled ? attributes.set(name, '') : attributes.delete(name),
    addEventListener: (name: string, handler: (event?: unknown) => void) => listeners.set(name, handler),
  };
  const script = buildPreviewDocument('https://example.com/model.glb', settings).match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  runInNewContext(script!, {
    document: { querySelector: (selector: string) => selector === 'model-viewer' ? viewer : { addEventListener() {} } },
    window: { parent, addEventListener: (_: string, handler: typeof receive) => { receive = handler; } },
  });
  const update = (next: typeof settings, source: object = parent) => receive({ source, data: { type: 'hero-preview-settings', settings: next } });
  return { attributes, colors, listeners, update };
}

describe('live Hero preview runtime', () => {
  it('updates lighting, camera and rotation without replacing the model', () => {
    const preview = runtime();
    preview.update({ ...settings, autoRotate: true, exposure: 2, shadowIntensity: .2, shadowSoftness: .1, cameraThetaDeg: 45, rotationPerSecondDeg: 30 });
    expect(preview.attributes.get('exposure')).toBe('2');
    expect(preview.attributes.get('shadow-intensity')).toBe('0.2');
    expect(preview.attributes.get('shadow-softness')).toBe('0.1');
    expect(preview.attributes.get('camera-orbit')).toBe('45deg 82deg 103%');
    expect(preview.attributes.get('rotation-per-second')).toBe('30deg');
    expect(preview.attributes.has('auto-rotate')).toBe(true);
    expect(preview.attributes.get('src')).toBe('model.glb');
    preview.update(settings);
    expect(preview.attributes.has('auto-rotate')).toBe(false);
  });
  it('applies tint with original alpha and restores original material colors', () => {
    const preview = runtime();
    preview.update({ ...settings, tint: '#ff0000' });
    expect(preview.colors.at(-1)).toEqual([1, 0, 0, .5]);
    preview.update({ ...settings, tint: '#00ff00' });
    expect(preview.colors.at(-1)).toEqual([0, 1, 0, .5]);
    preview.update(settings);
    expect(preview.colors.at(-1)).toEqual([.2, .3, .4, .5]);
  });
  it('ignores messages from other windows and malformed tint strings', () => {
    const preview = runtime();
    preview.update({ ...settings, exposure: 2 }, {});
    expect(preview.attributes.get('exposure')).toBe('1.08');
    preview.update({ ...settings, tint: '<script>' });
    expect(preview.colors.at(-1)).toEqual([.2, .3, .4, .5]);
  });
});
