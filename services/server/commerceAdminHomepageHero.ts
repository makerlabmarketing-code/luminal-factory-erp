import 'server-only';

import {
  homepageHeroEndpoints,
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
