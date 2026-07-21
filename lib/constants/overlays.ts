export const OVERLAY_Z_INDEX = {
  /** Confirmation backdrops must sit below global notifications. */
  confirmation: 999998,
  /** Toasts stay at the repository-mandated global notification layer. */
  notification: 999999,
} as const;
