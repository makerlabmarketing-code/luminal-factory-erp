import { getAdminEmployeeListData } from '@/services/server/adminEmployeeData';
import { AuthFlowError, requireSystemOwner } from '@/services/server/auth';
import PeopleWorkspace from './PeopleWorkspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminEmployeesPage() {
  const reviewAccess = process.env.COMPETENCY_REVIEWS_ENABLED === 'true'
    ? requireSystemOwner().then(() => true, () => false)
    : false;

  try {
    const initialData = await getAdminEmployeeListData();
    return <PeopleWorkspace initialData={initialData} showReviews={await reviewAccess} />;
  } catch (error) {
    const initialError = error instanceof AuthFlowError && error.status === 403 ? 'forbidden' : 'employee_list_load_failed';
    return <PeopleWorkspace initialError={initialError} showReviews={await reviewAccess} />;
  }
}
