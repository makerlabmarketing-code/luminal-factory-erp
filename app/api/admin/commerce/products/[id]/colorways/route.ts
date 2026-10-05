import { handleERPColorway } from '@/services/server/commerceAdminColorwayRoute';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Props) { return handleERPColorway(request, params); }
export async function POST(request: Request, { params }: Props) { return handleERPColorway(request, params); }
