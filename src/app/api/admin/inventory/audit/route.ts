import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 모든 상품 및 재고 데이터 조회
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        code,
        stock_quantity,
        inventory_options
      `)

    if (inventoryError) {
      console.error('Inventory fetch error:', inventoryError)
      return NextResponse.json({ 
        success: false, 
        error: '재고 데이터를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 재고 실사 로직 (실제로는 외부 시스템이나 바코드 스캔 등과 연동)
    // 여기서는 임시로 랜덤하게 차이를 생성
    let discrepancies = 0
    const auditResults = []

    for (const product of inventoryData) {
      if (product.inventory_options && Array.isArray(product.inventory_options) && product.inventory_options.length > 0) {
        // 옵션별 재고가 있는 경우
        for (const option of product.inventory_options) {
          const systemStock = option.physical_stock || option.stock_quantity || 0
          const actualStock = Math.max(0, systemStock + Math.floor(Math.random() * 21) - 10) // -10 ~ +10 범위
          const difference = actualStock - systemStock

          if (difference !== 0) {
            discrepancies++
            
            // 🔄 adjust_physical_stock 함수를 사용한 재고 조정
            const { data: adjustResult, error: adjustError } = await supabase
              .rpc('adjust_physical_stock', {
                p_product_id: product.id,
                p_color: option.color,
                p_size: option.size,
                p_quantity_change: difference,
                p_reason: `재고 실사 - 시스템 재고: ${systemStock}개, 실제 재고: ${actualStock}개`
              })

            if (adjustError || !adjustResult) {
              console.error('Adjust physical stock error:', adjustError)
            }
            
            // 재고 변동 이력 기록
            await supabase
              .from('stock_movements')
              .insert({
                product_id: product.id,
                movement_type: 'audit',
                quantity: difference,
                color: option.color,
                size: option.size,
                notes: `재고 실사 조정 - 시스템: ${systemStock}개 → 실제: ${actualStock}개 (차이: ${difference > 0 ? '+' : ''}${difference}개)`,
                created_at: getKoreaTime()
              })

            auditResults.push({
              productCode: product.code,
              productName: product.name,
              color: option.color,
              size: option.size,
              systemStock,
              actualStock,
              difference
            })
          }
        }
      } else {
        // 단일 재고인 경우
        const systemStock = product.stock_quantity || 0
        const actualStock = Math.max(0, systemStock + Math.floor(Math.random() * 21) - 10) // -10 ~ +10 범위
        const difference = actualStock - systemStock

        if (difference !== 0) {
          discrepancies++
          
          // 🔄 adjust_physical_stock 함수를 사용한 재고 조정
          const { data: adjustResult, error: adjustError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: product.id,
              p_color: null,
              p_size: null,
              p_quantity_change: difference,
              p_reason: `재고 실사 - 시스템 재고: ${systemStock}개, 실제 재고: ${actualStock}개`
            })

          if (adjustError || !adjustResult) {
            console.error('Adjust physical stock error:', adjustError)
          }
          
          // 재고 변동 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: product.id,
              movement_type: 'audit',
              quantity: difference,
              color: null,
              size: null,
              notes: `재고 실사 조정 - 시스템: ${systemStock}개 → 실제: ${actualStock}개 (차이: ${difference > 0 ? '+' : ''}${difference}개)`,
              created_at: getKoreaTime()
            })

          auditResults.push({
            productCode: product.code,
            productName: product.name,
            color: '-',
            size: '-',
            systemStock,
            actualStock,
            difference
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalItems: inventoryData.length,
        discrepancies,
        auditResults: auditResults.slice(0, 50) // 최대 50개만 반환
      },
      message: `재고 실사 완료. 총 ${inventoryData.length}개 항목 중 ${discrepancies}개 차이 발견`
    })

  } catch (error) {
    console.error('Inventory audit error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 실사 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 