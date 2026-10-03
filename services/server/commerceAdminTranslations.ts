import 'server-only';
import { matchesTranslationTarget, TRANSLATION_FIELDS, translationEndpoint, type TranslationContent, type TranslationMutation, type TranslationRecord, type TranslationTarget } from '@/lib/commerce-admin/translation-input';
import { requestCommerceAdmin } from './commerceAdminIntegration';

export function readCommerceTranslation(target: TranslationTarget) {
  return requestCommerceAdmin(translationEndpoint(target), (value): value is TranslationRecord | null => value === null || matchesTranslationTarget(value, target));
}
export function saveCommerceTranslation(target: TranslationTarget, mutation: TranslationMutation) {
  return requestCommerceAdmin(translationEndpoint(target, mutation), (value): value is TranslationRecord =>
    matchesTranslationTarget(value, target) && value.revision === mutation.expectedRevision + 1
    && value.ready === mutation.draft.ready && Object.keys(TRANSLATION_FIELDS).every(key => value.content[key as keyof TranslationContent] === mutation.draft.content[key as keyof TranslationContent]));
}
