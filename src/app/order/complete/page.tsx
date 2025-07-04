import { Suspense } from 'react'
import { OrderCompletePage } from '@/page-components/order/order-complete-page'

function OrderCompleteWithSuspense() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderCompletePage />
    </Suspense>
  )
}

export default function OrderComplete() {
  return <OrderCompleteWithSuspense />
} 