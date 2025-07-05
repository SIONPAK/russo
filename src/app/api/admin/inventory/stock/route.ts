import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const color = searchParams.get('color')
    const size = searchParams.get('size')

    if (!productId || !color || !size) {
      return NextResponse.json({ 
        success: false, 
        error: '필수 파라미터가 누락되었습니다.' 
      }, { status: 400 })
    }

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 재고 조회
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity, reserved_quantity')
      .eq('product_id', productId)
      .eq('color', color)
      .eq('size', size)
      .single()

    if (inventoryError) {
      // 재고 정보가 없는 경우 0으로 반환
      return NextResponse.json({
        success: true,
        data: {
          stock: 0,
          reserved: 0,
          available: 0
        }
      })
    }

    const availableStock = inventory.quantity - inventory.reserved_quantity

    return NextResponse.json({
      success: true,
      data: {
        stock: inventory.quantity,
        reserved: inventory.reserved_quantity,
        available: availableStock
      }
    })

  } catch (error) {
    console.error('Stock check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 조회 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 