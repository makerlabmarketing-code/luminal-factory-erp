'use client';

import AdminSidePanel from './AdminSidePanel';
import ActivityHistory from './ActivityHistory';

export default function ActivityHistoryDialog({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  return (
    <AdminSidePanel title="Lịch sử giao dịch" onClose={onClose}>
      <ActivityHistory entity="ledger" entityId={entityId} />
    </AdminSidePanel>
  );
}
