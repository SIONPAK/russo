import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 개별 샘플 아이템 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { itemId, status } = body

    if (!itemId || !status) {
      return NextResponse.json({
        success: false,
        error: '아이템 ID와 상태가 필요합니다.'
      }, { status: 400 })
    }

    // 유효한 상태 값 확인
    const validStatuses = ['pending', 'shipped', 'returned', 'charged']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 상태입니다.'
      }, { status: 400 })
    }

    // 샘플 아이템 정보 조회
    const { data: sampleItem, error: fetchError } = await supabase
      .from('sample_statement_items')
      .select(`
        *,
        sample_statements!inner (
          id,
          customer_id,
          customer_name
        )
      `)
      .eq('id', itemId)
      .single()

    if (fetchError || !sampleItem) {
      return NextResponse.json({
        success: false,
        error: '샘플 아이템을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const now = getKoreaTime()
    const updateData: any = {
      status,
      updated_at: now
    }

    // 상태별 처리
    switch (status) {
      case 'shipped':
        updateData.outgoing_date = now
        break
        
      case 'returned':
        updateData.return_date = now
        
        // 새로운 재고 관리 시스템으로 재고 복원
        const { data: restoreResult, error: restoreError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: sampleItem.product_id,
            p_color: sampleItem.color || null,
            p_size: sampleItem.size || null,
            p_quantity_change: sampleItem.quantity, // 양수로 복원
            p_reason: `샘플 개별 반납 - ${sampleItem.product_name} (${sampleItem.color}/${sampleItem.size})`
          })

        if (restoreError || !restoreResult) {
          console.error('❌ 샘플 재고 복원 실패:', restoreError)
        } else {
          console.log('✅ 샘플 재고 복원 완료:', sampleItem.product_name)
          
          // 재고 변동 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: sampleItem.product_id,
              movement_type: 'sample_return',
              quantity: sampleItem.quantity,
              color: sampleItem.color || null,
              size: sampleItem.size || null,
              notes: `샘플 개별 반납 - ${sampleItem.product_name} (${sampleItem.color}/${sampleItem.size})`,
              reference_id: sampleItem.id,
              reference_type: 'sample_item',
              created_at: now
            })
        }
        break
        
      case 'charged':
        updateData.charge_date = now
        
        // 마일리지 차감
        const chargeAmount = sampleItem.unit_price * sampleItem.quantity
        
        const { data: customer, error: customerError } = await supabase
          .from('users')
          .select('mileage_balance')
          .eq('id', sampleItem.sample_statements.customer_id)
          .single()

        if (!customerError && customer) {
          const currentMileage = customer.mileage_balance || 0
          
          if (currentMileage >= chargeAmount) {
            // 마일리지 차감
            await supabase
              .from('users')
              .update({
                mileage_balance: currentMileage - chargeAmount
              })
              .eq('id', sampleItem.sample_statements.customer_id)

            // 마일리지 이력 기록
            await supabase
              .from('mileage_logs')
              .insert({
                user_id: sampleItem.sample_statements.customer_id,
                type: 'deduction',
                amount: -chargeAmount,
                reason: 'sample_charge',
                reference_id: sampleItem.id,
                reference_type: 'sample_item',
                description: `샘플 개별 결제 - ${sampleItem.product_name} (${sampleItem.color}/${sampleItem.size})`,
                created_at: now
              })
          } else {
            return NextResponse.json({
              success: false,
              error: '마일리지 잔액이 부족합니다.'
            }, { status: 400 })
          }
        }
        break
    }

    // 샘플 아이템 상태 업데이트
    const { data: updatedItem, error: updateError } = await supabase
      .from('sample_statement_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: '상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: '샘플 아이템 상태가 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Individual status update error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 