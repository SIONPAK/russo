import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// 미출고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const companyName = searchParams.get('companyName')
    const productName = searchParams.get('productName')
    const priority = searchParams.get('priority')
    const autoShip = searchParams.get('autoShip')

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 미출고 상품 조회 (주문수량 > 출고수량인 항목들)
    let query = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_name,
        color,
        size,
        quantity,
        shipped_quantity,
        unit_price,
        orders!inner(
          order_number,
          created_at,
          users!inner(
            company_name,
            customer_grade
          )
        )
      `)
      .lt('shipped_quantity', 'quantity')

    const { data: orderItems, error: itemsError } = await query

    if (itemsError) {
      console.error('Order items fetch error:', itemsError)
      return NextResponse.json({ 
        success: false, 
        error: '미출고 데이터를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 미출고 데이터 구성
    const pendingShipments = orderItems.map((item: any, index: number) => {
      const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
      const totalPendingAmount = pendingQuantity * item.unit_price
      
      // 우선순위 설정 (고객 등급 기반)
      let priorityLevel = 1 // 일반
      if ((item.orders.users as any).customer_grade === 'premium') {
        priorityLevel = 2 // 우수업체
      } else if ((item.orders.users as any).customer_grade === 'vip') {
        priorityLevel = 3 // VIP (긴급)
      }

      // 임시 데이터 생성
      const autoShipEnabled = Math.random() > 0.4 // 60% 확률로 자동출고 활성화
      const expectedRestockDate = Math.random() > 0.5 ? 
        new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : 
        null

      return {
        id: `pending_${item.id}_${index}`,
        order_id: item.order_id,
        order_number: item.orders.order_number,
        company_name: (item.orders.users as any).company_name,
        customer_grade: (item.orders.users as any).customer_grade,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        ordered_quantity: item.quantity,
        shipped_quantity: item.shipped_quantity || 0,
        pending_quantity: pendingQuantity,
        unit_price: item.unit_price,
        total_pending_amount: totalPendingAmount,
        priority_level: priorityLevel,
        auto_ship_enabled: autoShipEnabled,
        created_at: item.orders.created_at,
        expected_restock_date: expectedRestockDate,
        notes: null
      }
    }).filter(item => item.pending_quantity > 0)

    // 필터 적용
    let filteredShipments = pendingShipments

    if (companyName) {
      filteredShipments = filteredShipments.filter(s => 
        s.company_name.toLowerCase().includes(companyName.toLowerCase())
      )
    }

    if (productName) {
      filteredShipments = filteredShipments.filter(s => 
        s.product_name.toLowerCase().includes(productName.toLowerCase())
      )
    }

    if (priority && priority !== 'all') {
      filteredShipments = filteredShipments.filter(s => 
        s.priority_level === parseInt(priority)
      )
    }

    if (autoShip && autoShip !== 'all') {
      const enabled = autoShip === 'enabled'
      filteredShipments = filteredShipments.filter(s => 
        s.auto_ship_enabled === enabled
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredShipments
    })

  } catch (error) {
    console.error('Pending shipments fetch error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '미출고 데이터 조회 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 미출고 처리 (자동 출고)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { action, pendingShipmentIds, productId, restockQuantity } = body

    if (action === 'auto_ship' && pendingShipmentIds) {
      // 선택된 미출고 항목들 자동 출고 처리
      return await processAutoShipment(supabase, pendingShipmentIds)
    } 
    else if (action === 'restock_notification' && productId && restockQuantity) {
      // 특정 상품 입고 시 자동 출고 처리
      return await processRestockAutoShip(supabase, productId, restockQuantity)
    }
    else {
      return NextResponse.json({
        success: false,
        error: '올바른 액션을 지정해주세요.'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Pending shipments processing error:', error)
    return NextResponse.json({
      success: false,
      error: '미출고 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 선택된 미출고 항목들 자동 출고 처리
async function processAutoShipment(supabase: any, pendingShipmentIds: string[]) {
  const results = []

  for (const pendingId of pendingShipmentIds) {
    // 미출고 정보 조회
    const { data: pending, error: pendingError } = await supabase
      .from('pending_shipments')
      .select(`
        *,
        orders!pending_shipments_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            company_name,
            email
          )
        )
      `)
      .eq('id', pendingId)
      .single()

    if (pendingError || !pending) {
      results.push({ pendingId, success: false, error: '미출고 정보를 찾을 수 없습니다.' })
      continue
    }

    // 현재 재고 확인
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', pending.product_id)
      .eq('color', pending.color)
      .eq('size', pending.size)
      .single()

    if (inventoryError || !inventory) {
      results.push({ pendingId, success: false, error: '재고 정보를 찾을 수 없습니다.' })
      continue
    }

    // 출고 가능한 수량 계산
    const availableQuantity = Math.min(inventory.quantity, pending.pending_quantity)

    if (availableQuantity <= 0) {
      results.push({ pendingId, success: false, error: '출고 가능한 재고가 없습니다.' })
      continue
    }

    try {
      // 트랜잭션 시작
      const { error: transactionError } = await supabase.rpc('process_pending_shipment', {
        pending_shipment_id: pendingId,
        ship_quantity: availableQuantity
      })

      if (transactionError) {
        throw transactionError
      }

      results.push({
        pendingId,
        success: true,
        shippedQuantity: availableQuantity,
        customerName: pending.orders?.users?.company_name,
        productName: pending.product_name
      })

    } catch (error) {
      console.error('Auto shipment processing error:', error)
      results.push({ pendingId, success: false, error: '출고 처리 중 오류가 발생했습니다.' })
    }
  }

  const successCount = results.filter(r => r.success).length
  
  return NextResponse.json({
    success: true,
    data: results,
    message: `${successCount}개 항목이 자동 출고 처리되었습니다.`
  })
}

// 특정 상품 입고 시 우선순위별 자동 출고 처리
async function processRestockAutoShip(supabase: any, productId: string, restockQuantity: number) {
  // 해당 상품의 미출고 목록을 우선순위별로 조회
  const { data: pendingList, error: pendingError } = await supabase
    .from('pending_shipments')
    .select(`
      *,
      orders!pending_shipments_order_id_fkey (
        order_number,
        users!orders_user_id_fkey (
          company_name,
          customer_grade,
          email
        )
      )
    `)
    .eq('product_id', productId)
    .eq('status', 'pending')
    .eq('auto_ship_enabled', true)
    .order('priority_level', { ascending: false }) // 높은 우선순위부터
    .order('created_at', { ascending: true }) // 오래된 주문부터

  if (pendingError || !pendingList || pendingList.length === 0) {
    return NextResponse.json({
      success: true,
      data: [],
      message: '자동 출고할 미출고 항목이 없습니다.'
    })
  }

  let remainingStock = restockQuantity
  const processedItems = []

  for (const pending of pendingList) {
    if (remainingStock <= 0) break

    // 색상/사이즈가 일치하는지 확인
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .eq('color', pending.color)
      .eq('size', pending.size)
      .single()

    if (inventoryError || !inventory) continue

    // 출고 가능한 수량 계산
    const shipQuantity = Math.min(
      pending.pending_quantity,
      inventory.quantity,
      remainingStock
    )

    if (shipQuantity <= 0) continue

    try {
      // 출고 처리
      const { error: shipError } = await supabase.rpc('process_pending_shipment', {
        pending_shipment_id: pending.id,
        ship_quantity: shipQuantity
      })

      if (!shipError) {
        processedItems.push({
          orderId: pending.order_id,
          orderNumber: pending.orders?.order_number,
          customerName: pending.orders?.users?.company_name,
          productName: pending.product_name,
          color: pending.color,
          size: pending.size,
          shippedQuantity: shipQuantity,
          customerGrade: pending.orders?.users?.customer_grade
        })

        remainingStock -= shipQuantity
      }

    } catch (error) {
      console.error('Restock auto ship error:', error)
      continue
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processedItems,
      totalProcessed: processedItems.length,
      totalShippedQuantity: restockQuantity - remainingStock,
      remainingStock
    },
    message: `입고 알림으로 ${processedItems.length}개 항목이 자동 출고되었습니다.`
  })
} 