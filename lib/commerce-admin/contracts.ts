export const COMMERCE_ADMIN_CONTRACT_VERSION = '2026-09-11';
export const COMMERCE_ADMIN_SIGNATURE_VERSION = 'lfc-hmac-v1';
export const COMMERCE_ADMIN_MANAGEMENT_PREFIX = '/api/admin/v1';
export const HOMEPAGE_HERO_ASSET_MAX_BYTES = 10 * 1024 * 1024;

export type CommerceAdminCapability =
  | 'COMMERCE_RAFFLE_VIEW'
  | 'COMMERCE_RAFFLE_MANAGE'
  | 'COMMERCE_RAFFLE_ENTRY_VIEW'
  | 'COMMERCE_HOMEPAGE_HERO_VIEW'
  | 'COMMERCE_HOMEPAGE_HERO_MANAGE'
  | 'COMMERCE_PRODUCT_VIEW'
  | 'COMMERCE_PRODUCT_MANAGE';

export type CommerceAdminScope =
  | 'commerce.raffle.read'
  | 'commerce.raffle.write'
  | 'commerce.raffle.entry.read'
  | 'commerce.hero.read'
  | 'commerce.hero.write'
  | 'commerce.hero.publish'
  | 'commerce.product.read'
  | 'commerce.product.write';

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

export type HomepageHeroAssetKind = 'model' | 'poster';

export type HomepageHeroAssetContentType =
  | 'model/gltf-binary'
  | 'application/octet-stream'
  | 'image/webp'
  | 'image/avif'
  | 'image/png';

export interface HomepageHeroAssetPresentation {
  kind: HomepageHeroAssetKind;
  path: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: string | null;
  publicUrl: string;
}

export interface HomepageHeroAssetUploadTicketRequest {
  kind: HomepageHeroAssetKind;
  fileName: string;
  contentType: HomepageHeroAssetContentType;
  sizeBytes: number;
}

export interface HomepageHeroAssetUploadTicket {
  kind: HomepageHeroAssetKind;
  path: string;
  contentType: string;
  sizeBytes: number;
  signedUrl: string;
  token: string;
  publicUrl: string;
  expiresInSeconds: number;
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
  assets(): CommerceAdminEndpoint {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_VIEW',
      scope: 'commerce.hero.read',
      method: 'GET',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/assets`,
    };
  },
  createAssetUploadTicket(
    body: HomepageHeroAssetUploadTicketRequest,
  ): CommerceAdminEndpoint<HomepageHeroAssetUploadTicketRequest> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.write',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/assets/upload-ticket`,
      body,
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
  applyLive(id: string, body: HomepageHeroDraftMutation & { expectedUpdatedAt: string }): CommerceAdminEndpoint<HomepageHeroDraftMutation & { expectedUpdatedAt: string }> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.publish',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/${encodeURIComponent(id)}/apply`,
      body,
    };
  },
  deleteDraft(id: string, body: HomepageHeroPublishMutation): CommerceAdminEndpoint<HomepageHeroPublishMutation> {
    return {
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.write',
      method: 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/homepage-hero/${encodeURIComponent(id)}/delete`,
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

/** Commerce remains authoritative; draft writes use a dedicated capability. */
export interface CommerceProductRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  product_type: string;
  release_type: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommerceProductDraft {
  slug: string;
  name: string;
  description: string | null;
  productType: 'artisan_keycap' | 'collectible_object' | 'custom_object' | 'other';
  releaseType: 'direct' | 'preorder' | 'informational';
}

export interface CommerceProductDraftMutation {
  operationId: string;
  draft: CommerceProductDraft;
}

export const commerceProductEndpoints = {
  create(body: CommerceProductDraftMutation): CommerceAdminEndpoint<CommerceProductDraftMutation> {
    return { capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write',
      method: 'POST', path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/products`, body };
  },
  update(id: string, body: CommerceProductDraftMutation): CommerceAdminEndpoint<CommerceProductDraftMutation> {
    return { capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write',
      method: 'PATCH', path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/products/${encodeURIComponent(id)}`, body };
  },
  list(): CommerceAdminEndpoint {
    return {
      capability: 'COMMERCE_PRODUCT_VIEW',
      scope: 'commerce.product.read',
      method: 'GET',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/products`,
    };
  },
};

export interface CommerceColorwayDraft { name: string; slug: string; description: string | null }
export interface CommerceColorwayMutation { operationId: string; draft: CommerceColorwayDraft }
export interface CommerceColorwayRecord {
  name: string; slug: string | null; description: string | null;
  id: string; product_id: string; is_active: boolean; created_at: string; updated_at: string;
}
export const commerceColorwayEndpoints = {
  list(id: string): CommerceAdminEndpoint {
    return { capability: 'COMMERCE_PRODUCT_VIEW', scope: 'commerce.product.read', method: 'GET',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/products/${encodeURIComponent(id)}/colorways` };
  },
  save(id: string, variantId: string | null, body: CommerceColorwayMutation): CommerceAdminEndpoint<CommerceColorwayMutation> {
    return { capability: 'COMMERCE_PRODUCT_MANAGE', scope: 'commerce.product.write', method: variantId ? 'PATCH' : 'POST',
      path: `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/products/${encodeURIComponent(id)}/colorways${variantId ? `/${encodeURIComponent(variantId)}` : ''}`, body };
  },
};
