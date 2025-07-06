import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 첫 번째 상품 ID 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, code')
      .limit(1)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '테스트할 상품을 찾을 수 없습니다.'
      }, { status: 400 })
    }

    // 테스트 데이터 삽입
    const testData = {
      product_id: product.id,
      movement_type: 'test',
      quantity: 1,
      notes: '테스트 데이터 삽입',
      created_at: new Date().toISOString()
    }

    console.log('테스트 데이터 삽입 시도:', testData)

    const { data: result, error: insertError } = await supabase
      .from('stock_movements')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('테스트 데이터 삽입 실패:', insertError)
      return NextResponse.json({
        success: false,
        error: `데이터 삽입 실패: ${insertError.message}`,
        details: insertError
      }, { status: 500 })
    }

    console.log('테스트 데이터 삽입 성공:', result)

    // 데이터 조회 테스트
    const { data: movements, error: selectError } = await supabase
      .from('stock_movements')
      .select('*')
      .limit(5)

    if (selectError) {
      console.error('데이터 조회 실패:', selectError)
    }

    return NextResponse.json({
      success: true,
      message: '테스트 데이터 삽입 성공',
      insertedData: result,
      allMovements: movements,
      productInfo: product
    })

  } catch (error) {
    console.error('테스트 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 