import ProductWorkspace from '../ProductWorkspace';
export const dynamic = 'force-dynamic';
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductWorkspace productId={id} />;
}
