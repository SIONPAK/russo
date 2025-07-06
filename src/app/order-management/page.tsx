import { Suspense } from 'react'
import { OrderManagementPage } from '@/page-components/order-management/order-management-page'
import { MainLayout } from '@/widgets/layout/main-layout'

function OrderManagementContent() {
  return <OrderManagementPage />
}

export default function OrderManagement() {
  return (
    <MainLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        </div>
      }>
        <OrderManagementContent />
      </Suspense>
    </MainLayout>
  )
} 