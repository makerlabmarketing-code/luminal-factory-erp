'use client';

import { useEffect, useState } from 'react';

export function useProjectTaskRealtime(projectId: number | undefined, refresh: () => Promise<unknown>) {
  const [connectedProject, setConnectedProject] = useState<number>();
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TASK_BOARD_REALTIME_FREE !== 'true' || !projectId) return;

    let closed = false;
    let channelCleanup: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (closed || timer || document.visibilityState !== 'visible') return;
      timer = setTimeout(() => {
        timer = undefined;
        void refresh().catch(() => {});
      }, 350);
    };

    void import('@/utils/supabase/client').then(({ supabase }) => {
      if (closed) return;
      const channel = supabase.channel(`erp:task-board:${projectId}`, { config: { private: true } });
      channelCleanup = () => { void supabase.removeChannel(channel); };
      channel.on('broadcast', { event: 'tasks-changed' }, scheduleRefresh).subscribe(status => {
        if (closed) return;
        setConnectedProject(status === 'SUBSCRIBED' ? projectId : undefined);
        if (status === 'SUBSCRIBED') scheduleRefresh();
      });
    }).catch(() => { if (!closed) setConnectedProject(undefined); });
    document.addEventListener('visibilitychange', scheduleRefresh);
    window.addEventListener('online', scheduleRefresh);
    return () => {
      closed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', scheduleRefresh);
      window.removeEventListener('online', scheduleRefresh);
      channelCleanup?.();
    };
  }, [projectId, refresh]);

  return Boolean(projectId && connectedProject === projectId);
}
