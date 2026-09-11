export const COMMERCE_ADMIN_CONTRACT_VERSION = '2026-09-11';
export const COMMERCE_ADMIN_SIGNATURE_VERSION = 'lfc-hmac-v1';
export const COMMERCE_ADMIN_MANAGEMENT_PREFIX = '/api/admin/v1';

export type CommerceAdminCapability =
  | 'COMMERCE_HOMEPAGE_HERO_VIEW'
  | 'COMMERCE_HOMEPAGE_HERO_MANAGE';

export type CommerceAdminScope =
  | 'commerce.hero.read'
  | 'commerce.hero.write'
  | 'commerce.hero.publish';

export type CommerceAdminHttpMethod = 'GET' | 'POST' | 'PATCH';

export interface CommerceAdminActor {
  authUserId: string;
  employeeId: string;
}

export interface CommerceAdminResponseMeta {
  contractVersion: typeof COMMERCE_ADMIN_CONTRACT_VERSION;
  requestId: string;
}

export interface CommerceAdminSuccess<TData> {
  ok: true;
  data: TData;
  meta: CommerceAdminResponseMeta;
}

export interface CommerceAdminFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta: CommerceAdminResponseMeta;
}

export type CommerceAdminResponse<TData> = CommerceAdminSuccess<TData> | CommerceAdminFailure;

export interface HomepageHeroPresentationSettings {
  tint: string | null;
  exposure: number;
  shadowIntensity: number;
  shadowSoftness: number;
  autoRotate: boolean;
  autoRotateDelayMs: number;
  rotationPerSecondDeg: number;
  cameraThetaDeg: number;
  cameraPhiDeg: number;
  cameraRadiusPercent: number;
  cameraIntroRadiusPercent: number;
  cameraMinRadiusPercent: number;
  cameraMaxRadiusPercent: number;
  cameraFieldOfViewDeg: number;
  cameraMinFieldOfViewDeg: number;
  cameraMaxFieldOfViewDeg: number;
}

export interface HomepageHeroPresentation {
  id: string;
  name: string;
  modelStoragePath: string;
  posterStoragePath: string | null;
  settings: HomepageHeroPresentationSettings;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageHeroDraftInput {
  name: string;
  modelStoragePath: string;
  posterStoragePath?: string | null;
  settings?: Partial<HomepageHeroPresentationSettings>;
}

export interface HomepageHeroDraftMutation {
  operationId: string;
  draft: HomepageHeroDraftInput;
}

export interface HomepageHeroPublishMutation {
  operationId: string;
}

export interface CommerceAdminEndpoint<TBody = undefined> {
  capability: CommerceAdminCapability;
  scope: CommerceAdminScope;
  method: CommerceAdminHttpMethod;
  path: string;
  body?: TBody;
}

export const homepageHeroEndpoints = {
  list(): CommerceAdminEndpoint {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_VIEW',
      scope: 'commerce.hero.read',
      method: 'GET',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero`,
    };
  },
  create(body: HomepageHeroDraftMutation): CommerceAdminEndpoint<HomepageHeroDraftMutation> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.write',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero`,
      body,
    };
  },
  update(id: string, body: HomepageHeroDraftMutation): CommerceAdminEndpoint<HomepageHeroDraftMutation> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.write',
      method: 'PATCH',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/${encodeURIComponent(id)}`,
      body,
    };
  },
  publish(id: string, body: HomepageHeroPublishMutation): CommerceAdminEndpoint<HomepageHeroPublishMutation> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.publish',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/${encodeURIComponent(id)}/publish`,
      body,
    };
  },
  unpublish(id: string, body: HomepageHeroPublishMutation): CommerceAdminEndpoint<HomepageHeroPublishMutation> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.publish',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/${encodeURIComponent(id)}/unpublish`,
      body,
    };
  },
};
