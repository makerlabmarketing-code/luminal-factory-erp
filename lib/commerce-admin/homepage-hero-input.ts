import type {
  HomepageHeroAssetContentType,
  HomepageHeroAssetUploadTicketRequest,
  HomepageHeroDraftMutation,
  HomepageHeroPresentationSettings,
  HomepageHeroPublishMutation,
} from '@/lib/commerce-admin/contracts';
import { HOMEPAGE_HERO_ASSET_MAX_BYTES } from '@/lib/commerce-admin/contracts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  integer = false,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  if (value < minimum || value > maximum) return null;
  return value;
}

function parseSettings(value: unknown): Partial<HomepageHeroPresentationSettings> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;

  const settings: Partial<HomepageHeroPresentationSettings> = {};

  if ('tint' in value) {
    if (
      value.tint !== null &&
      (typeof value.tint !== 'string' || !HEX_COLOR_PATTERN.test(value.tint))
    ) {
      return null;
    }
    settings.tint = value.tint as string | null;
  }

  if ('autoRotate' in value) {
    if (typeof value.autoRotate !== 'boolean') return null;
    settings.autoRotate = value.autoRotate;
  }

  const numericFields: Array<{
    key: keyof HomepageHeroPresentationSettings;
    min: number;
    max: number;
    integer?: boolean;
  }> = [
    { key: 'exposure', min: 0.4, max: 2.5 },
    { key: 'shadowIntensity', min: 0, max: 2 },
    { key: 'shadowSoftness', min: 0, max: 1 },
    { key: 'autoRotateDelayMs', min: 0, max: 30_000, integer: true },
    { key: 'rotationPerSecondDeg', min: 0, max: 30 },
    { key: 'cameraThetaDeg', min: -360, max: 360 },
    { key: 'cameraPhiDeg', min: 5, max: 175 },
    { key: 'cameraRadiusPercent', min: 50, max: 250 },
    { key: 'cameraIntroRadiusPercent', min: 50, max: 250 },
    { key: 'cameraMinRadiusPercent', min: 40, max: 250 },
    { key: 'cameraMaxRadiusPercent', min: 50, max: 300 },
    { key: 'cameraFieldOfViewDeg', min: 10, max: 70 },
    { key: 'cameraMinFieldOfViewDeg', min: 8, max: 70 },
    { key: 'cameraMaxFieldOfViewDeg', min: 10, max: 90 },
  ];

  for (const field of numericFields) {
    if (!(field.key in value)) continue;
    const parsed = readFiniteNumber(
      value[field.key],
      field.min,
      field.max,
      field.integer,
    );
    if (parsed === null) return null;
    (settings as Record<string, unknown>)[field.key] = parsed;
  }

  if (
    settings.cameraMinRadiusPercent !== undefined &&
    settings.cameraRadiusPercent !== undefined &&
    settings.cameraMinRadiusPercent > settings.cameraRadiusPercent
  ) {
    return null;
  }
  if (
    settings.cameraMaxRadiusPercent !== undefined &&
    settings.cameraRadiusPercent !== undefined &&
    settings.cameraRadiusPercent > settings.cameraMaxRadiusPercent
  ) {
    return null;
  }
  if (
    settings.cameraMinFieldOfViewDeg !== undefined &&
    settings.cameraFieldOfViewDeg !== undefined &&
    settings.cameraMinFieldOfViewDeg > settings.cameraFieldOfViewDeg
  ) {
    return null;
  }
  if (
    settings.cameraMaxFieldOfViewDeg !== undefined &&
    settings.cameraFieldOfViewDeg !== undefined &&
    settings.cameraFieldOfViewDeg > settings.cameraMaxFieldOfViewDeg
  ) {
    return null;
  }

  return settings;
}

function isSafeStoragePath(value: string): boolean {
  return (
    value.length <= 512 &&
    !value.startsWith('/') &&
    !value.includes('//') &&
    !/(^|\/)\.\.?(\/|$)/.test(value)
  );
}

export function parseHomepageHeroDraftMutation(
  value: unknown,
): HomepageHeroDraftMutation | null {
  if (
    !isRecord(value) ||
    typeof value.operationId !== 'string' ||
    !UUID_PATTERN.test(value.operationId)
  ) {
    return null;
  }
  if (!isRecord(value.draft)) return null;

  const name = typeof value.draft.name === 'string' ? value.draft.name.trim() : '';
  const modelStoragePath =
    typeof value.draft.modelStoragePath === 'string'
      ? value.draft.modelStoragePath.trim()
      : '';
  const posterStoragePath =
    value.draft.posterStoragePath === null ||
    value.draft.posterStoragePath === undefined
      ? null
      : typeof value.draft.posterStoragePath === 'string'
        ? value.draft.posterStoragePath.trim()
        : '';

  if (!name || name.length > 120) return null;
  if (
    !modelStoragePath ||
    !isSafeStoragePath(modelStoragePath) ||
    !/\.glb$/i.test(modelStoragePath)
  ) {
    return null;
  }
  if (
    posterStoragePath !== null &&
    (!posterStoragePath ||
      !isSafeStoragePath(posterStoragePath) ||
      !/\.(webp|avif|png)$/i.test(posterStoragePath))
  ) {
    return null;
  }

  const settings = parseSettings(value.draft.settings);
  if (!settings) return null;

  return {
    operationId: value.operationId,
    draft: {
      name,
      modelStoragePath,
      posterStoragePath,
      settings,
    },
  };
}

export function parseHomepageHeroPublishMutation(
  value: unknown,
): HomepageHeroPublishMutation | null {
  if (
    !isRecord(value) ||
    typeof value.operationId !== 'string' ||
    !UUID_PATTERN.test(value.operationId)
  ) {
    return null;
  }
  return { operationId: value.operationId };
}

export function parseHomepageHeroAssetUploadTicketRequest(
  value: unknown,
): HomepageHeroAssetUploadTicketRequest | null {
  if (!isRecord(value)) return null;
  if (value.kind !== 'model' && value.kind !== 'poster') return null;
  if (typeof value.fileName !== 'string') return null;

  const fileName = value.fileName.trim();
  if (!fileName || fileName.length > 180 || /[\\/]/.test(fileName)) return null;

  if (
    typeof value.sizeBytes !== 'number' ||
    !Number.isInteger(value.sizeBytes) ||
    value.sizeBytes < 1 ||
    value.sizeBytes > HOMEPAGE_HERO_ASSET_MAX_BYTES
  ) {
    return null;
  }

  const allowedContentTypes: readonly HomepageHeroAssetContentType[] = [
    'model/gltf-binary',
    'application/octet-stream',
    'image/webp',
    'image/avif',
    'image/png',
  ];

  if (
    typeof value.contentType !== 'string' ||
    !allowedContentTypes.includes(
      value.contentType as HomepageHeroAssetContentType,
    )
  ) {
    return null;
  }

  const contentType = value.contentType as HomepageHeroAssetContentType;
  const lowerName = fileName.toLowerCase();

  if (value.kind === 'model') {
    if (!lowerName.endsWith('.glb')) return null;
    if (
      contentType !== 'model/gltf-binary' &&
      contentType !== 'application/octet-stream'
    ) {
      return null;
    }
  } else {
    const expected = lowerName.endsWith('.webp')
      ? 'image/webp'
      : lowerName.endsWith('.avif')
        ? 'image/avif'
        : lowerName.endsWith('.png')
          ? 'image/png'
          : null;
    if (!expected || contentType !== expected) return null;
  }

  return {
    kind: value.kind,
    fileName,
    contentType,
    sizeBytes: value.sizeBytes,
  };
}

export function parseHomepageHeroId(value: string): string | null {
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}
