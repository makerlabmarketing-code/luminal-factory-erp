import { notFound, redirect } from 'next/navigation';
import { AuthFlowError, requireWorkspaceAccess } from '@/services/server/auth';

export default async function StaffCompetencyPage() {
  if (process.env.COMPETENCY_REVIEWS_ENABLED !== 'true') notFound();
  try {
    await requireWorkspaceAccess('STAFF_WORKSPACE');
  } catch (error) {
    if (error instanceof AuthFlowError && (error.status === 403 || error.status === 401)) notFound();
    throw error;
  }
  redirect('/staff/profile?section=competency#competency');
}
