'use client'

import { useState } from 'react'
import { ProductList } from '@/features/admin/product-management/ui/product-list'
import { ProductModal } from '@/features/admin/product-management/ui/product-modal'
import { ProductDetailModal } from '@/features/admin/product-management/ui/product-detail-modal'
import { useProductManagement } from '@/features/admin/product-management/model/use-product-management'
import { Product } from '@/shared/types'

export default function ProductsPage() {
  const {
    products,
    categories,
    loading,
    error,
    filters,
    pagination,
    createProduct,
    updateProduct,
    deleteProduct,
    setFilters,
    setPage,
  } = useProductManagement()

  // 모달 상태 관리
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleViewDetail = (product: Product) => {
    setSelectedProduct(product)
    setIsDetailModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      const result = await deleteProduct(id)
      if (result.success) {
        // 성공 처리는 훅 내부에서 이미 처리됨
      } else {
        alert(result.error || '삭제 중 오류가 발생했습니다.')
      }
    }
  }

  const handleSave = async (productData: any) => {
    let result
    if (selectedProduct) {
      result = await updateProduct(selectedProduct.id, productData)
    } else {
      result = await createProduct(productData)
    }

    if (result.success) {
      setIsModalOpen(false)
      setSelectedProduct(null)
    } else {
      alert(result.error || '저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
        <p className="text-gray-600 mt-2">상품 등록 및 정보 관리</p>
      </div>

      <ProductList
        products={products}
        categories={categories}
        loading={loading}
        error={error}
        filters={filters}
        pagination={pagination}
        onFiltersChange={setFilters}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={() => {
          setSelectedProduct(null)
          setIsModalOpen(true)
        }}
        onViewDetail={handleViewDetail}
      />

      <ProductModal
        product={selectedProduct}
        categories={categories}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProduct(null)
        }}
        onSave={handleSave}
      />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedProduct(null)
        }}
        onEdit={() => {
          setIsDetailModalOpen(false)
          setIsModalOpen(true)
        }}
      />
    </div>
  )
} 