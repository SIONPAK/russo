import { ProductDetailPage } from '@/pages/product/product-detail-page'

interface ProductPageProps {
  params: {
    id: string
  }
}

export default function ProductPage({ params }: ProductPageProps) {
  return <ProductDetailPage productId={params.id} />
} 