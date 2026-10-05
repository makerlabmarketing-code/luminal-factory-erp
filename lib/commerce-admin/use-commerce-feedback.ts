'use client';
import { useCallback, useState } from 'react';
import { useNotification } from '@/component/NotificationContext';

export function useCommerceFeedback() {
  const { showToast } = useNotification();
  const [message, setMessage] = useState('');
  const success = useCallback((text: string) => { setMessage(text); showToast('Thành công', text, 'success'); }, [showToast]);
  const error = useCallback((text: string) => { setMessage(text); showToast('Không thể thực hiện', text, 'error'); }, [showToast]);
  const loaded = useCallback((text: string) => showToast('Đã tải dữ liệu', text, 'success'), [showToast]);
  return { message, setMessage, success, error, loaded };
}
