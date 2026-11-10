import { notFound } from 'next/navigation';
import CompetencyWorkspace from '@/component/competency-reviews/CompetencyWorkspace';
import { AuthFlowError, requireSystemOwner } from '@/services/server/auth';

export default async function AdminCompetencyPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  if (process.env.COMPETENCY_REVIEWS_ENABLED !== 'true') notFound();
  try {
    await requireSystemOwner();
  } catch (error) {
    if (error instanceof AuthFlowError && (error.status === 403 || error.status === 401)) notFound();
    throw error;
  }
  const { employee } = await searchParams;
  return <CompetencyWorkspace admin initialEmployeeId={typeof employee === 'string' && /^[1-9]\d*$/.test(employee) ? employee : ''} />;
}
