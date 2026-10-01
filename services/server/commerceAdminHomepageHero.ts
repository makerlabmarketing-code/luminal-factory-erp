import 'server-only';

import {
  homepageHeroEndpoints,
  type HomepageHeroAssetPresentation,
  type HomepageHeroAssetUploadTicket,
  type HomepageHeroAssetUploadTicketRequest,
  type HomepageHeroDraftMutation,
  type HomepageHeroPresentation,
  type HomepageHeroPublishMutation,
} from '@/lib/commerce-admin/contracts';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHomepageHeroPresentation(value: unknown): value is HomepageHeroPresentation {
  if (!isRecord(value) || !isRecord(value.settings)) return false;
  const settings = value.settings;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.modelStoragePath === 'string' &&
    (value.posterStoragePath === null || typeof value.posterStoragePath === 'string') &&
    (value.status === 'DRAFT' || value.status === 'PUBLISHED') &&
    (value.publishedAt === null || typeof value.publishedAt === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (settings.tint === null || typeof settings.tint === 'string') &&
    typeof settings.exposure === 'number' &&
    typeof settings.shadowIntensity === 'number' &&
    typeof settings.shadowSoftness === 'number' &&
    typeof settings.autoRotate === 'boolean' &&
    typeof settings.autoRotateDelayMs === 'number' &&
    typeof settings.rotationPerSecondDeg === 'number' &&
    typeof settings.cameraThetaDeg === 'number' &&
    typeof settings.cameraPhiDeg === 'number' &&
    typeof settings.cameraRadiusPercent === 'number' &&
    typeof settings.cameraIntroRadiusPercent === 'number' &&
    typeof settings.cameraMinRadiusPercent === 'number' &&
    typeof settings.cameraMaxRadiusPercent === 'number' &&
    typeof settings.cameraFieldOfViewDeg === 'number' &&
    typeof settings.cameraMinFieldOfViewDeg === 'number' &&
    typeof settings.cameraMaxFieldOfViewDeg === 'number'
  );
}

function isHomepageHeroList(value: unknown): value is HomepageHeroPresentation[] {
  return Array.isArray(value) && value.every(isHomepageHeroPresentation);
}

function isHomepageHeroAssetPresentation(value: unknown): value is HomepageHeroAssetPresentation {
  return (
    isRecord(value) &&
    (value.kind === 'model' || value.kind === 'poster') &&
    typeof value.path === 'string' &&
    typeof value.fileName === 'string' &&
    typeof value.contentType === 'string' &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    (value.updatedAt === null || typeof value.updatedAt === 'string') &&
    typeof value.publicUrl === 'string'
  );
}

function isHomepageHeroAssetList(value: unknown): value is HomepageHeroAssetPresentation[] {
  return Array.isArray(value) && value.every(isHomepageHeroAssetPresentation);
}

function isHomepageHeroAssetUploadTicket(value: unknown): value is HomepageHeroAssetUploadTicket {
  return (
    isRecord(value) &&
    (value.kind === 'model' || value.kind === 'poster') &&
    typeof value.path === 'string' &&
    typeof value.contentType === 'string' &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    typeof value.signedUrl === 'string' &&
    typeof value.token === 'string' &&
    typeof value.publicUrl === 'string' &&
    typeof value.expiresInSeconds === 'number' &&
    Number.isFinite(value.expiresInSeconds)
  );
}

export function listHomepageHeroPresentations(): Promise<HomepageHeroPresentation[]> {
  return requestCommerceAdmin(homepageHeroEndpoints.list(), isHomepageHeroList);
}

export function createHomepageHeroDraft(
  mutation: HomepageHeroDraftMutation,
): Promise<HomepageHeroPresentation> {
  return requestCommerceAdmin(homepageHeroEndpoints.create(mutation), isHomepageHeroPresentation);
}

export function updateHomepageHeroDraft(
  heroId: string,
  mutation: HomepageHeroDraftMutation,
): Promise<HomepageHeroPresentation> {
  return requestCommerceAdmin(homepageHeroEndpoints.update(heroId, mutation), isHomepageHeroPresentation);
}

export function applyHomepageHeroLive(
  heroId: string,
  mutation: HomepageHeroDraftMutation & { expectedUpdatedAt: string },
): Promise<HomepageHeroPresentation> {
  return requestCommerceAdmin(homepageHeroEndpoints.applyLive(heroId, mutation), isHomepageHeroPresentation);
}

export function deleteHomepageHeroDraft(
  heroId: string,
  mutation: HomepageHeroPublishMutation,
): Promise<{ deletedId: string }> {
  return requestCommerceAdmin(
    homepageHeroEndpoints.deleteDraft(heroId, mutation),
    (value): value is { deletedId: string } => isRecord(value) && typeof value.deletedId === 'string' && value.deletedId === heroId,
  );
}

export function publishHomepageHero(
  heroId: string,
  mutation: HomepageHeroPublishMutation,
): Promise<HomepageHeroPresentation> {
  return requestCommerceAdmin(homepageHeroEndpoints.publish(heroId, mutation), isHomepageHeroPresentation);
}

export function unpublishHomepageHero(
  heroId: string,
  mutation: HomepageHeroPublishMutation,
): Promise<HomepageHeroPresentation> {
  return requestCommerceAdmin(homepageHeroEndpoints.unpublish(heroId, mutation), isHomepageHeroPresentation);
}


export function listHomepageHeroAssets(): Promise<HomepageHeroAssetPresentation[]> {
  return requestCommerceAdmin(homepageHeroEndpoints.assets(), isHomepageHeroAssetList);
}

export function createHomepageHeroAssetUploadTicket(
  request: HomepageHeroAssetUploadTicketRequest,
): Promise<HomepageHeroAssetUploadTicket> {
  return requestCommerceAdmin(
    homepageHeroEndpoints.createAssetUploadTicket(request),
    isHomepageHeroAssetUploadTicket,
  );
}
