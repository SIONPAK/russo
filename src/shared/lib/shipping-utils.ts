import { createClient } from '@/shared/lib/supabase/server'

// 배송비 계산 함수 (당일 중복 주문 고려)
export async function calculateShippingFee(
  userId: string,
  totalQuantity: number,
  excludeOrderId?: string
): Promise<number> {
  // 20장 이상이면 무료배송
  if (totalQuantity >= 20) {
    return 0
  }

  try {
    const supabase = await createClient()
    
    // 같은 사용자의 당일 주문 확인 (배송비 중복 청구 방지)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    
    let query = supabase
      .from('orders')
      .select('id, shipping_fee, total_amount')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .neq('status', 'cancelled') // 취소된 주문 제외
    
    // 특정 주문 제외 (수정 시 기존 주문 제외)
    if (excludeOrderId) {
      query = query.neq('id', excludeOrderId)
    }
    
    const { data: todayOrders, error: todayOrdersError } = await query
    
    if (todayOrdersError) {
      console.error('당일 주문 조회 오류:', todayOrdersError)
      // 오류 시 안전하게 배송비 적용
      return 3000
    }
    
    const hasExistingOrderToday = todayOrders && todayOrders.length > 0
    
    if (hasExistingOrderToday) {
      // 당일 기존 주문이 있으면 배송비 없음 (이미 지불했으므로)
      console.log(`🚚 배송비 적용 안함 - 당일 기존 주문 ${todayOrders.length}개 존재`)
      return 0
    } else {
      // 당일 첫 주문이면 배송비 적용
      console.log('🚚 배송비 3,000원 적용 - 당일 첫 주문')
      return 3000
    }
  } catch (error) {
    console.error('배송비 계산 중 오류:', error)
    // 오류 시 안전하게 배송비 적용
    return 3000
  }
}

// 출고 명세서용 배송비 계산 (같은 고객의 당일 다른 출고 고려)
export async function calculateShippingFeeForStatement(
  userId: string,
  totalShippedQuantity: number,
  currentOrderId: string
): Promise<number> {
  // 20장 이상이면 무료배송
  if (totalShippedQuantity >= 20) {
    return 0
  }

  try {
    const supabase = await createClient()
    
    // 같은 사용자의 당일 다른 출고된 주문 확인
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    
    const { data: todayShippedOrders, error } = await supabase
      .from('orders')
      .select('id, shipping_fee')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .neq('id', currentOrderId) // 현재 주문 제외
      .in('status', ['shipped', 'completed']) // 출고된 주문만
      .neq('status', 'cancelled') // 취소된 주문 제외
    
    if (error) {
      console.error('당일 출고 주문 조회 오류:', error)
      return 3000 // 오류 시 안전하게 배송비 적용
    }
    
    // 당일 이미 배송비를 지불한 주문이 있는지 확인
    const hasExistingShippingFee = todayShippedOrders && 
      todayShippedOrders.some(order => order.shipping_fee > 0)
    
    if (hasExistingShippingFee) {
      console.log(`🚚 배송비 적용 안함 - 당일 배송비 지불한 출고 주문 존재`)
      return 0
    } else {
      console.log('🚚 배송비 3,000원 적용 - 당일 첫 출고 또는 배송비 미지불')
      return 3000
    }
  } catch (error) {
    console.error('출고 명세서 배송비 계산 중 오류:', error)
    return 3000 // 오류 시 안전하게 배송비 적용
  }
} 