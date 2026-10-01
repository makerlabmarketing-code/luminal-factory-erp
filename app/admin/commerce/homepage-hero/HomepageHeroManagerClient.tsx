'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  ExternalLink,
  FileBox,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import { buildPreviewDocument } from '@/lib/commerce-admin/hero-preview';
import { createCommerceMutationRetry } from '@/lib/commerce-admin/mutation-retry';
import {
  HOMEPAGE_HERO_ASSET_MAX_BYTES,
  type HomepageHeroAssetContentType,
  type HomepageHeroAssetKind,
  type HomepageHeroAssetPresentation,
  type HomepageHeroAssetUploadTicket,
  type HomepageHeroDraftInput,
  type HomepageHeroPresentation,
  type HomepageHeroPresentationSettings,
} from '@/lib/commerce-admin/contracts';

type DraftState = HomepageHeroDraftInput & {
  settings: HomepageHeroPresentationSettings;
};

type ApiFailure = {
  success: false;
  code?: string;
  message: string;
};

type ApiSuccess<T extends Record<string, unknown>> = { success: true } & T;

const DEFAULT_SETTINGS: HomepageHeroPresentationSettings = {
  tint: null,
  exposure: 1.08,
  shadowIntensity: 1,
  shadowSoftness: 0.72,
  autoRotate: false,
  autoRotateDelayMs: 700,
  rotationPerSecondDeg: 3,
  cameraThetaDeg: 12,
  cameraPhiDeg: 82,
  cameraRadiusPercent: 103,
  cameraIntroRadiusPercent: 103,
  cameraMinRadiusPercent: 78,
  cameraMaxRadiusPercent: 155,
  cameraFieldOfViewDeg: 29,
  cameraMinFieldOfViewDeg: 22,
  cameraMaxFieldOfViewDeg: 42,
};

const NUMBER_FIELDS: Array<{
  key: keyof HomepageHeroPresentationSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'exposure', label: 'Độ sáng', min: 0.4, max: 2.5, step: 0.01 },
  { key: 'shadowIntensity', label: 'Độ đậm bóng', min: 0, max: 2, step: 0.01 },
  { key: 'shadowSoftness', label: 'Độ mềm bóng', min: 0, max: 1, step: 0.01 },
  { key: 'cameraThetaDeg', label: 'Góc ngang camera', min: -360, max: 360, step: 1 },
  { key: 'cameraPhiDeg', label: 'Góc dọc camera', min: 5, max: 175, step: 1 },
  { key: 'cameraRadiusPercent', label: 'Khoảng cách camera', min: 50, max: 250, step: 1 },
  { key: 'cameraIntroRadiusPercent', label: 'Khoảng cách mở đầu', min: 50, max: 250, step: 1 },
  { key: 'cameraMinRadiusPercent', label: 'Khoảng cách gần nhất', min: 40, max: 250, step: 1 },
  { key: 'cameraMaxRadiusPercent', label: 'Khoảng cách xa nhất', min: 50, max: 300, step: 1 },
  { key: 'cameraFieldOfViewDeg', label: 'Góc nhìn', min: 10, max: 70, step: 1 },
  { key: 'cameraMinFieldOfViewDeg', label: 'Góc nhìn nhỏ nhất', min: 8, max: 70, step: 1 },
  { key: 'cameraMaxFieldOfViewDeg', label: 'Góc nhìn lớn nhất', min: 10, max: 90, step: 1 },
  { key: 'autoRotateDelayMs', label: 'Độ trễ tự xoay (ms)', min: 0, max: 30000, step: 100 },
  { key: 'rotationPerSecondDeg', label: 'Tốc độ xoay (độ/giây)', min: 0, max: 30, step: 0.5 },
];

function draftFromHero(hero: HomepageHeroPresentation): DraftState {
  return {
    name: hero.name,
    modelStoragePath: hero.modelStoragePath,
    posterStoragePath: hero.posterStoragePath,
    settings: { ...hero.settings },
  };
}

function emptyDraft(modelStoragePath = ''): DraftState {
  return {
    name: 'Hero trang chủ',
    modelStoragePath,
    posterStoragePath: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function requestJson<T extends Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<ApiSuccess<T>> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (!response.ok || !payload || payload.success !== true) {
    const failure = payload && payload.success === false ? payload : null;
    const error = new Error(failure?.message || 'Không thể hoàn tất yêu cầu.');
    Object.assign(error, {
      code: failure?.code || 'request_failed',
      status: response.status,
    });
    throw error;
  }

  return payload;
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể hoàn tất yêu cầu.';
}

function assetContentType(
  file: File,
  kind: HomepageHeroAssetKind,
): HomepageHeroAssetContentType | null {
  const name = file.name.toLowerCase();
  if (kind === 'model') {
    return name.endsWith('.glb') ? 'model/gltf-binary' : null;
  }
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.avif')) return 'image/avif';
  if (name.endsWith('.png')) return 'image/png';
  return null;
}

export default function HomepageHeroManagerClient() {
  const { showConfirm, showToast } = useNotification();
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const previewSettingsRef = useRef(DEFAULT_SETTINGS);
  const [previewStatus, setPreviewStatus] = useState('Đang tải mô hình...');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewReaderRef = useRef<FileReader | null>(null);
  const [localModelPreview, setLocalModelPreview] = useState<{ url: string; name: string } | null>(null);
  const mutationInFlight = useRef(false);
  const mutationRetry = useRef(createCommerceMutationRetry());
  const [heroes, setHeroes] = useState<HomepageHeroPresentation[]>([]);
  const [assets, setAssets] = useState<HomepageHeroAssetPresentation[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [integrationDisabled, setIntegrationDisabled] = useState(false);
  const [uploadKind, setUploadKind] = useState<HomepageHeroAssetKind>('model');

  const loadData = useCallback(
    async (preferredHeroId: string | null = null, showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const [heroPayload, assetPayload] = await Promise.all([
          requestJson<{ heroes: HomepageHeroPresentation[] }>(
            '/api/admin/commerce/homepage-hero',
          ),
          requestJson<{ assets: HomepageHeroAssetPresentation[] }>(
            '/api/admin/commerce/homepage-hero/assets',
          ),
        ]);

        const nextHeroes = heroPayload.heroes;
        const nextAssets = assetPayload.assets;
        setHeroes(nextHeroes);
        setAssets(nextAssets);
        setIntegrationDisabled(false);

        const selected =
          nextHeroes.find((hero) => hero.id === preferredHeroId) ||
          nextHeroes[0] ||
          null;

        if (selected) {
          setSelectedHeroId(selected.id);
          setDraft(draftFromHero(selected));
        } else {
          const firstModel = nextAssets.find((asset) => asset.kind === 'model');
          setSelectedHeroId(null);
          setDraft(emptyDraft(firstModel?.path || ''));
        }
      } catch (error) {
        if (errorCode(error) === 'INTEGRATION_DISABLED') {
          setIntegrationDisabled(true);
        } else {
          showToast('Không tải được Hero', errorMessage(error), 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadData(null, false);
  }, [loadData]);

  const selectedHero =
    heroes.find((hero) => hero.id === selectedHeroId) || null;
  const modelAssets = assets.filter((asset) => asset.kind === 'model');
  const posterAssets = assets.filter((asset) => asset.kind === 'poster');
  const selectedModelAsset =
    modelAssets.find((asset) => asset.path === draft.modelStoragePath) || null;
  const previewUrl = localModelPreview?.url || safeHttpsUrl(selectedModelAsset?.publicUrl) ||
    (integrationDisabled ? 'https://luminalfactory.com/models/meowhe-hero.glb' : null);
  const previewDocument = previewUrl
    ? buildPreviewDocument(previewUrl, DEFAULT_SETTINGS)
    : null;

  const sendPreviewSettings = useCallback(() => {
    previewFrameRef.current?.contentWindow?.postMessage({
      type: 'hero-preview-settings', settings: previewSettingsRef.current,
    }, '*');
  }, []);

  useEffect(() => {
    previewSettingsRef.current = draft.settings;
    sendPreviewSettings();
  }, [draft.settings, sendPreviewSettings]);
  useEffect(() => { setPreviewStatus('Đang tải mô hình...'); }, [previewUrl]);
  useEffect(() => {
    const receivePreviewState = (event: MessageEvent) => {
      if (event.source !== previewFrameRef.current?.contentWindow) return;
      if (event.data?.type === 'hero-preview-ready') {
        setPreviewStatus('Mô hình đã tải · thông số được áp dụng trực tiếp');
        sendPreviewSettings();
      } else if (event.data?.type === 'hero-preview-error') {
        setPreviewStatus('Không tải được mô hình. Vui lòng chọn lại GLB hoặc tải lại trang.');
      }
    };
    window.addEventListener('message', receivePreviewState);
    return () => window.removeEventListener('message', receivePreviewState);
  }, [sendPreviewSettings]);
  const hasUnsavedChanges = selectedHero
    ? JSON.stringify(draft) !== JSON.stringify(draftFromHero(selectedHero))
    : JSON.stringify(draft) !==
      JSON.stringify(emptyDraft(modelAssets[0]?.path || ''));

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges]);

  useEffect(() => () => { previewReaderRef.current?.abort(); }, []);

  function clearLocalPreview() {
    previewReaderRef.current?.abort();
    previewReaderRef.current = null;
    setLocalModelPreview(null);
  }

  function previewLocalModel(file: File) {
    if (!assetContentType(file, 'model') || file.size < 1 || file.size > HOMEPAGE_HERO_ASSET_MAX_BYTES) {
      showToast('Không thể xem tệp', 'Chọn GLB có dung lượng từ 1 đến 10.485.760 byte (10 MiB).', 'info');
      return;
    }
    previewReaderRef.current?.abort();
    const reader = new FileReader();
    previewReaderRef.current = reader;
    reader.onload = () => {
      if (previewReaderRef.current === reader && typeof reader.result === 'string') {
        setLocalModelPreview({ url: reader.result, name: file.name });
      }
    };
    reader.onerror = () => {
      if (previewReaderRef.current === reader) showToast('Không đọc được tệp', 'Vui lòng chọn lại tệp GLB.', 'error');
    };
    reader.readAsDataURL(new Blob([file], { type: 'model/gltf-binary' }));
  }

  function confirmDiscardChanges(next: () => void) {
    if (!hasUnsavedChanges) {
      next();
      return;
    }
    showConfirm(
      'Bỏ thay đổi chưa lưu?',
      'Những chỉnh sửa chưa lưu sẽ mất. Bạn có muốn tiếp tục?',
      next,
      { confirmLabel: 'Bỏ thay đổi', cancelLabel: 'Hủy' },
    );
  }

  function selectHero(hero: HomepageHeroPresentation) {
    if (hero.id === selectedHeroId) return;
    confirmDiscardChanges(() => {
      clearLocalPreview();
      setSelectedHeroId(hero.id);
      setDraft(draftFromHero(hero));
    });
  }

  function beginNewDraft() {
    confirmDiscardChanges(() => {
      clearLocalPreview();
      setSelectedHeroId(null);
      setDraft(emptyDraft(modelAssets[0]?.path || ''));
    });
  }

  function updateSetting(
    key: keyof HomepageHeroPresentationSettings,
    value: number | boolean | string | null,
  ) {
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  }

  async function saveDraft() {
    if (integrationDisabled || localModelPreview || mutationInFlight.current) return;
    if (!draft.name.trim() || !draft.modelStoragePath) {
      showToast(
        'Thiếu thông tin',
        'Vui lòng nhập tên và chọn mô hình 3D.',
        'info',
      );
      return;
    }

    mutationInFlight.current = true;
    setSaving(true);
    try {
      const draftInput = {
        name: draft.name.trim(),
        modelStoragePath: draft.modelStoragePath,
        posterStoragePath: draft.posterStoragePath || null,
        settings: draft.settings,
      };
      // A published Hero is immutable: saving edits creates a new inactive draft.
      // No intermediate selection step is required and the live Hero stays intact.
      const createDraft = !selectedHeroId || selectedHero?.status === 'PUBLISHED';
      const url = createDraft
        ? '/api/admin/commerce/homepage-hero'
        : '/api/admin/commerce/homepage-hero/' + encodeURIComponent(selectedHeroId);
      const method = createDraft ? 'POST' : 'PATCH';
      const operationId = mutationRetry.current.prepare(url, method, { draft: draftInput });
      const mutation = { operationId, draft: draftInput };
      const payload = await requestJson<{ hero: HomepageHeroPresentation }>(
        url,
        {
          method,
          body: JSON.stringify(mutation),
        },
      );
      mutationRetry.current.confirm(operationId);
      setSelectedHeroId(payload.hero.id);
      setDraft(draftFromHero(payload.hero));
      showToast(
        'Đã lưu bản nháp',
        'Cấu hình Hero đã được lưu trên Commerce.',
        'success',
      );
      await loadData(payload.hero.id, false);
    } catch (error) {
      showToast('Không lưu được Hero', errorMessage(error), 'error');
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  async function applyLiveHero() {
    if (selectedHero?.status !== 'PUBLISHED' || !hasUnsavedChanges ||
        integrationDisabled || localModelPreview || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    try {
      const url = '/api/admin/commerce/homepage-hero/' + encodeURIComponent(selectedHero.id) + '/apply';
      const draftInput = {
        name: draft.name.trim(),
        modelStoragePath: draft.modelStoragePath,
        posterStoragePath: draft.posterStoragePath || null,
        settings: draft.settings,
      };
      const input = { draft: draftInput, expectedUpdatedAt: selectedHero.updatedAt };
      const operationId = mutationRetry.current.prepare(url, 'POST', input);
      const payload = await requestJson<{ hero: HomepageHeroPresentation }>(url, {
        method: 'POST',
        body: JSON.stringify({ ...input, operationId }),
      });
      mutationRetry.current.confirm(operationId);
      setSelectedHeroId(payload.hero.id);
      setDraft(draftFromHero(payload.hero));
      showToast('Đã áp dụng Hero', 'Commerce đã cập nhật cấu hình đang dùng, không tạo thêm bản nháp.', 'success');
      await loadData(payload.hero.id, false);
    } catch (error) {
      showToast('Không áp dụng được Hero', errorMessage(error), 'error');
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  function confirmApplyHero() {
    if (!selectedHero || selectedHero.status !== 'PUBLISHED' || !hasUnsavedChanges) return;
    showConfirm(
      'Áp dụng thay đổi trực tiếp lên trang chủ?',
      'Hero đang dùng sẽ cập nhật ngay sau khi lưu thành công. Không tạo bản nháp mới. Hãy kiểm tra kỹ cấu hình trước khi xác nhận.',
      () => void applyLiveHero(),
      { confirmLabel: 'Áp dụng lên trang chủ', cancelLabel: 'Hủy' },
    );
  }

  async function deleteDraftHero(hero: HomepageHeroPresentation) {
    if (hero.status !== 'DRAFT' || integrationDisabled || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    try {
      const url = '/api/admin/commerce/homepage-hero/' + encodeURIComponent(hero.id) + '/delete';
      const operationId = mutationRetry.current.prepare(url, 'POST', {});
      await requestJson<{ deletedId: string }>(url, {
        method: 'POST',
        body: JSON.stringify({ operationId }),
      });
      mutationRetry.current.confirm(operationId);
      if (selectedHeroId === hero.id) {
        clearLocalPreview();
        setSelectedHeroId(null);
      }
      showToast('Đã xóa phiên bản', 'Đã xóa cấu hình không còn hoạt động. Tệp 3D không bị xóa.', 'success');
      await loadData(selectedHeroId === hero.id ? null : selectedHeroId, false);
    } catch (error) {
      showToast('Không xóa được bản nháp', errorMessage(error), 'error');
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  function confirmDeleteDraft(hero: HomepageHeroPresentation) {
    if (hero.status !== 'DRAFT') return;
    showConfirm(
      hero.publishedAt ? 'Xóa phiên bản Hero cũ?' : 'Xóa bản nháp Hero?',
      hero.publishedAt
        ? 'Đây là phiên bản từng được xuất bản. Xóa sẽ mất lựa chọn khôi phục phiên bản này, nhưng không ảnh hưởng Hero đang dùng hoặc tệp GLB.'
        : 'Chỉ xóa cấu hình nháp này, không xóa tệp 3D hoặc Hero đang dùng. Thao tác không thể hoàn tác.',
      () => void deleteDraftHero(hero),
      { confirmLabel: 'Xóa bản nháp', cancelLabel: 'Hủy' },
    );
  }

  async function changePublishState(action: 'publish' | 'unpublish') {
    if (integrationDisabled || localModelPreview || !selectedHeroId || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    try {
      const url = '/api/admin/commerce/homepage-hero/' + encodeURIComponent(selectedHeroId) + '/' + action;
      const operationId = mutationRetry.current.prepare(url, 'POST', {});
      const payload = await requestJson<{ hero: HomepageHeroPresentation }>(
        url,
        {
          method: 'POST',
          body: JSON.stringify({ operationId }),
        },
      );
      mutationRetry.current.confirm(operationId);
      setDraft(draftFromHero(payload.hero));
      showToast(
        action === 'publish' ? 'Đã dùng Hero mới' : 'Đã dừng Hero',
        action === 'publish'
          ? 'Commerce sẽ dùng cấu hình Hero vừa chọn.'
          : 'Hero đã được chuyển về trạng thái bản nháp.',
        'success',
      );
      await loadData(payload.hero.id, false);
    } catch (error) {
      showToast(
        'Không đổi được trạng thái Hero',
        errorMessage(error),
        'error',
      );
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  function confirmPublishChange(action: 'publish' | 'unpublish') {
    if (hasUnsavedChanges && action === 'unpublish') {
      showConfirm(
        'Dừng Hero và bỏ các chỉnh sửa chưa lưu?',
        'Hero sẽ ngừng hiển thị cấu hình đã xuất bản. Các thông số bạn vừa chỉnh nhưng chưa lưu sẽ bị bỏ.',
        () => void changePublishState('unpublish'),
        { confirmLabel: 'Dừng Hero', cancelLabel: 'Hủy' },
      );
      return;
    }
    if (hasUnsavedChanges) {
      showToast(
        'Có thay đổi chưa lưu',
        'Hãy lưu nháp trước khi đổi trạng thái Hero.',
        'info',
      );
      return;
    }
    showConfirm(
      action === 'publish'
        ? 'Dùng Hero này trên Commerce?'
        : 'Dừng Hero đang dùng?',
      action === 'publish'
        ? 'Sau khi xác nhận, Commerce sẽ chuyển Hero trang chủ sang cấu hình này.'
        : 'Sau khi xác nhận, Hero này sẽ không còn ở trạng thái đang dùng.',
      () => changePublishState(action),
      {
        confirmLabel: action === 'publish' ? 'Dùng Hero này' : 'Dừng Hero',
        cancelLabel: 'Hủy',
      },
    );
  }

  async function uploadAsset(file: File) {
    const contentType = assetContentType(file, uploadKind);
    if (!contentType) {
      showToast(
        'Sai định dạng tệp',
        uploadKind === 'model'
          ? 'Chỉ nhận tệp GLB.'
          : 'Chỉ nhận PNG, WebP hoặc AVIF.',
        'info',
      );
      return;
    }
    if (file.size < 1 || file.size > HOMEPAGE_HERO_ASSET_MAX_BYTES) {
      showToast(
        'Tệp quá lớn',
        `Tệp Hero phải có từ 1 đến ${HOMEPAGE_HERO_ASSET_MAX_BYTES.toLocaleString('vi-VN')} byte (10 MiB).`,
        'info',
      );
      return;
    }

    setUploading(true);
    try {
      const ticketPayload = await requestJson<{
        ticket: HomepageHeroAssetUploadTicket;
      }>('/api/admin/commerce/homepage-hero/assets/upload-ticket', {
        method: 'POST',
        body: JSON.stringify({
          kind: uploadKind,
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      const ticket = ticketPayload.ticket;

      const uploadResponse = await fetch(ticket.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': ticket.contentType,
          'Cache-Control': 'no-store',
        },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error('Không thể tải tệp lên kho Commerce.');
      }

      const assetPayload = await requestJson<{
        assets: HomepageHeroAssetPresentation[];
      }>('/api/admin/commerce/homepage-hero/assets');

      setAssets(assetPayload.assets);
      setDraft((current) => ({
        ...current,
        modelStoragePath:
          uploadKind === 'model' ? ticket.path : current.modelStoragePath,
        posterStoragePath:
          uploadKind === 'poster' ? ticket.path : current.posterStoragePath,
      }));

      showToast(
        'Đã tải tệp lên',
        'Tệp đã được thêm vào thư viện Hero. Hãy lưu bản nháp để sử dụng.',
        'success',
      );
    } catch (error) {
      showToast('Không tải được tệp', errorMessage(error), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-blue-400" aria-hidden="true" />
            <h1 className="admin-page-title">Hero trang chủ</h1>
          </div>
          <p className="admin-page-description">
            Quản lý mô hình 3D, góc camera và trạng thái Hero của Commerce.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="admin-button-secondary"
            onClick={() =>
              confirmDiscardChanges(() => void loadData(selectedHeroId, true))
            }
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            onClick={beginNewDraft}
            disabled={loading}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Bản nháp mới
          </button>
        </div>
      </header>

      {integrationDisabled ? (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          <p className="font-bold">Kết nối Commerce đang tắt</p>
          <p className="mt-1 text-xs leading-5 text-amber-200/75">
            Bạn vẫn có thể xoay mô hình mẫu, chọn GLB trên máy và chỉnh góc xem thử.
            Tải lên, lưu nháp và dùng Hero cần kết nối Commerce được xác minh.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-card overflow-hidden">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-100">Các bản Hero</h2>
            <p className="mt-1 text-xs text-slate-500">
              {heroes.length} cấu hình
            </p>
          </div>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="admin-skeleton h-20" />
            ) : heroes.length === 0 ? (
              <p className="p-3 text-xs leading-5 text-slate-500">
                Chưa tải được cấu hình Hero.
              </p>
            ) : (
              heroes.map((hero) => (
                <div
                  key={hero.id}
                  className={
                    'relative rounded-lg border transition ' +
                    (selectedHeroId === hero.id
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/60')
                  }
                >
                  <button
                    type="button"
                    onClick={() => selectHero(hero)}
                    className="w-full rounded-lg p-3 pb-11 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-100">{hero.name}</span>
                      <span className={
                        'admin-badge ' +
                        (hero.status === 'PUBLISHED'
                          ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
                          : 'border-slate-700 text-slate-400')
                      }>
                        {hero.status === 'PUBLISHED' ? 'Đang dùng' : hero.publishedAt ? 'Bản cũ' : 'Bản nháp'}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-slate-500">{hero.modelStoragePath}</p>
                  </button>
                  {hero.status === 'DRAFT' ? (
                    <button
                      type="button"
                      aria-label={`Xóa ${hero.publishedAt ? 'phiên bản cũ' : 'bản nháp'} ${hero.name}`}
                      title={hero.publishedAt ? 'Xóa phiên bản cũ' : 'Xóa bản nháp'}
                      className="absolute bottom-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 shadow-sm hover:border-red-500/60 hover:bg-red-500/15 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-40"
                      disabled={saving || uploading || integrationDisabled}
                      onClick={() => confirmDeleteDraft(hero)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="space-y-5">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    Xem trước 3D
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Kéo trực tiếp trong khung để kiểm tra góc. {previewStatus}
                  </p>
                </div>
                {previewUrl && !localModelPreview ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-icon-button"
                    aria-label="Mở tệp mô hình"
                    title="Mở tệp mô hình"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              <div className="border-b border-slate-800 p-4">
                <label className="block text-xs text-slate-300">
                  Chọn GLB trên máy để xem thử
                  <input
                    className="mt-2 block w-full text-xs"
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) previewLocalModel(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Chỉ xem trên máy, không tải lên hay lưu vào Commerce. Tối đa 10.485.760 byte.
                  {localModelPreview ? ` Đang xem: ${localModelPreview.name}. Bỏ tệp xem thử trước khi lưu hoặc dùng Hero.` : integrationDisabled ? ' Đang dùng mô hình mẫu Meowhe.' : ''}
                </p>
                {localModelPreview ? (
                  <button type="button" className="admin-button-secondary mt-2" onClick={clearLocalPreview}>
                    Bỏ tệp xem thử
                  </button>
                ) : null}
              </div>
              <div className="aspect-[4/3] min-h-[320px] bg-slate-950">
                {previewDocument ? (
                  <iframe
                    title="Xem trước mô hình Hero"
                    className="h-full w-full border-0"
                    ref={previewFrameRef}
                    onLoad={sendPreviewSettings}
                    srcDoc={previewDocument}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
                    <div>
                      <FileBox className="mx-auto h-9 w-9 text-slate-600" />
                      <p className="mt-3 text-sm font-bold text-slate-300">
                        Chưa có mô hình để xem trước
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Chọn tệp GLB trên máy để xem thử, hoặc chọn tệp đã tải lên khi có kết nối.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-card p-4">
              <h2 className="text-sm font-bold text-slate-100">Tệp Hero</h2>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="admin-label">Mô hình 3D</span>
                  <select
                    className="admin-field mt-1.5"
                    value={draft.modelStoragePath}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        modelStoragePath: event.target.value,
                      }))
                    }
                    disabled={integrationDisabled}
                  >
                    <option value="">Chọn mô hình GLB</option>
                    {modelAssets.map((asset) => (
                      <option key={asset.path} value={asset.path}>
                        {asset.fileName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="admin-label">Ảnh poster dự phòng</span>
                  <select
                    className="admin-field mt-1.5"
                    value={draft.posterStoragePath || ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        posterStoragePath: event.target.value || null,
                      }))
                    }
                    disabled={integrationDisabled}
                  >
                    <option value="">Không dùng poster</option>
                    {posterAssets.map((asset) => (
                      <option key={asset.path} value={asset.path}>
                        {asset.fileName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <label className="admin-label" htmlFor="hero-upload-kind">
                    Loại tệp tải lên
                  </label>
                  <select
                    id="hero-upload-kind"
                    className="admin-field mt-1.5"
                    value={uploadKind}
                    onChange={(event) =>
                      setUploadKind(
                        event.target.value as HomepageHeroAssetKind,
                      )
                    }
                    disabled={integrationDisabled || uploading}
                  >
                    <option value="model">Mô hình GLB</option>
                    <option value="poster">Ảnh poster</option>
                  </select>
                  <input
                    ref={fileInputRef}
                    className="mt-3 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200"
                    type="file"
                    accept={
                      uploadKind === 'model'
                        ? '.glb,model/gltf-binary'
                        : '.png,.webp,.avif,image/png,image/webp,image/avif'
                    }
                    disabled={integrationDisabled || uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAsset(file);
                    }}
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Tối đa {HOMEPAGE_HERO_ASSET_MAX_BYTES.toLocaleString('vi-VN')} byte (10 MiB). Tệp được tải bằng quyền tạm thời 2 giờ.
                  </p>
                  {uploading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                      <Upload className="h-3.5 w-3.5" />
                      Đang tải tệp...
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card p-4 sm:p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="admin-label">Tên cấu hình</span>
                  <input
                    className="admin-field mt-1.5"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={saving || uploading}
                    maxLength={120}
                  />
                </label>

                <div>
                  <label className="admin-label" htmlFor="hero-tint">
                    Màu phủ
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="hero-tint"
                      className="admin-field"
                      value={draft.settings.tint || ''}
                      placeholder="#FFFFFF"
                      onChange={(event) =>
                        updateSetting(
                          'tint',
                          event.target.value.trim() || null,
                        )
                      }
                      disabled={saving || uploading}
                    />
                    <input
                      aria-label="Chọn màu phủ"
                      type="color"
                      className="h-10 w-12 rounded-lg border border-slate-700 bg-slate-950 p-1"
                      value={draft.settings.tint || '#ffffff'}
                      onChange={(event) =>
                        updateSetting('tint', event.target.value)
                      }
                      disabled={saving || uploading}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Màu phủ áp lên vật liệu 3D và hòa với màu có sẵn trong texture. Xóa mã màu để trở về màu gốc.
                  </p>
                </div>

                <label className="flex min-h-[44px] items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <span>
                    <span className="block text-xs font-bold text-slate-200">
                      Tự xoay
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Xoay theo tốc độ bên cạnh; 3°/giây sẽ chuyển động chậm.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.settings.autoRotate}
                    onChange={(event) =>
                      updateSetting('autoRotate', event.target.checked)
                    }
                    disabled={saving || uploading}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {NUMBER_FIELDS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="admin-label">{field.label}</span>
                    <input
                      className="admin-field mt-1.5"
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={String(draft.settings[field.key])}
                      disabled={saving || uploading}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateSetting(field.key, value);
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">
                {selectedHero
                  ? selectedHero.status === 'PUBLISHED'
                    ? 'Hero đang dùng'
                    : 'Bản nháp đã lưu'
                  : 'Bản nháp mới'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {selectedHero?.status === 'PUBLISHED'
                  ? 'Chỉnh sửa rồi chọn Lưu nháp để tạo bản chỉnh sửa mới, không ảnh hưởng Hero đang dùng.'
                  : 'Lưu bản nháp không thay đổi Hero đang dùng. Dùng Hero là thao tác riêng có xác nhận.'}
              </p>
            </div>
            <div>
              {integrationDisabled || localModelPreview ? (
                <p className="mb-2 text-xs text-amber-200" role="status">
                  {integrationDisabled
                    ? 'Chưa thể lưu vào Commerce: kết nối đang tắt. Các thay đổi hiện chỉ để xem thử.'
                    : 'Chưa thể lưu khi đang xem GLB trên máy. Bỏ tệp xem thử, tải tệp lên Commerce rồi chọn tệp đã tải.'}
                </p>
              ) : null}
            <div className="flex flex-wrap gap-2">
              {selectedHero?.status === 'PUBLISHED' ? (
                <button
                  type="button"
                  className="admin-button-primary"
                  onClick={confirmApplyHero}
                  disabled={integrationDisabled || Boolean(localModelPreview) || saving || !hasUnsavedChanges}
                >
                  <Upload className="h-4 w-4" />
                  {saving ? 'Đang áp dụng...' : 'Áp dụng lên trang chủ'}
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-button-primary"
                  onClick={() => void saveDraft()}
                  disabled={integrationDisabled || Boolean(localModelPreview) || saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Đang lưu...' : 'Lưu nháp'}
                </button>
              )}

              {selectedHero?.status === 'PUBLISHED' ? (
                <button
                  type="button"
                  className="admin-button-secondary"
                  onClick={() => confirmPublishChange('unpublish')}
                  disabled={integrationDisabled ||
                  Boolean(localModelPreview) || saving}
                >
                  <Pause className="h-4 w-4" />
                  Dừng Hero
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-button-secondary"
                  onClick={() => confirmPublishChange('publish')}
                  disabled={
                    integrationDisabled ||
                  Boolean(localModelPreview) ||
                    saving ||
                    !selectedHeroId ||
                    hasUnsavedChanges
                  }
                >
                  <Play className="h-4 w-4" />
                  Dùng Hero này
                </button>
              )}
            </div>
            </div>
          </section>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {loading
          ? 'Đang tải dữ liệu Hero.'
          : uploading
            ? 'Đang tải tệp Hero.'
            : saving
              ? 'Đang lưu Hero.'
              : ''}
      </div>
    </div>
  );
}
