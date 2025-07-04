import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// PUT - 추천상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params
    const body = await request.json()
    
    const { product_id, type, order_index, is_active } = body

    // 추천상품 존재 확인
    const { data: existing, error: existingError } = await supabase
      .from('featured_products')
      .select('id, product_id, type')
      .eq('id', id)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({
        success: false,
        error: '추천상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 상품 변경 시 존재 확인
    if (product_id && product_id !== existing.product_id) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id')
        .eq('id', product_id)
        .single()

      if (productError || !product) {
        return NextResponse.json({
          success: false,
          error: '존재하지 않는 상품입니다.'
        }, { status: 400 })
      }

      // 중복 확인 (같은 타입에서 같은 상품이 이미 있는지)
      const checkType = type || existing.type
      const { data: duplicate } = await supabase
        .from('featured_products')
        .select('id')
        .eq('product_id', product_id)
        .eq('type', checkType)
        .neq('id', id)
        .single()

      if (duplicate) {
        return NextResponse.json({
          success: false,
          error: '이미 추가된 상품입니다.'
        }, { status: 400 })
      }
    }

    const updateData: any = {}
    if (product_id !== undefined) updateData.product_id = product_id
    if (type !== undefined) updateData.type = type
    if (order_index !== undefined) updateData.order_index = order_index
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: featuredProduct, error } = await supabase
      .from('featured_products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        products (
          id,
          name,
          price,
          sale_price,
          is_on_sale,
          stock_quantity,
          images:product_images!product_images_product_id_fkey (
            image_url,
            is_main
          )
        )
      `)
      .single()

    if (error) {
      console.error('Featured product update error:', error)
      return NextResponse.json({
        success: false,
        error: '추천상품 수정에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: featuredProduct,
      message: '추천상품이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Featured product update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// DELETE - 추천상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params

    const { error } = await supabase
      .from('featured_products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Featured product delete error:', error)
      return NextResponse.json({
        success: false,
        error: '추천상품 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '추천상품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Featured product delete API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 