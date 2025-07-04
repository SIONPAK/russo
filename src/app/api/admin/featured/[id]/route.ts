import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// PUT - 추천 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      product_id,
      title,
      description,
      display_order,
      is_active,
      start_date,
      end_date,
      badge_text,
      badge_color
    } = body

    // 필수 필드 검증
    if (!product_id || !title) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 상품 존재 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 상품입니다.' },
        { status: 400 }
      )
    }

    // 다른 추천 상품에서 같은 상품 사용 중인지 확인 (자신 제외)
    const { data: existingFeatured } = await supabase
      .from('featured_products')
      .select('id')
      .eq('product_id', product_id)
      .neq('id', id)
      .single()

    if (existingFeatured) {
      return NextResponse.json(
        { success: false, error: '이미 추천 상품으로 등록된 상품입니다.' },
        { status: 400 }
      )
    }

    // 같은 순서의 다른 추천 상품이 있는지 확인 (자신 제외)
    if (display_order) {
      const { data: existingOrder } = await supabase
        .from('featured_products')
        .select('id')
        .eq('display_order', display_order)
        .neq('id', id)
        .single()

      if (existingOrder) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 표시 순서입니다.' },
          { status: 400 }
        )
      }
    }

    const { data: featured, error } = await supabase
      .from('featured_products')
      .update({
        product_id,
        title,
        description,
        display_order,
        is_active,
        start_date,
        end_date,
        badge_text,
        badge_color,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        product:products(id, name, price, images:product_images(image_url, is_main))
      `)
      .single()

    if (error) {
      console.error('Featured product update error:', error)
      return NextResponse.json(
        { success: false, error: '추천 상품 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: featured,
      message: '추천 상품이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Featured product update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE - 추천 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('featured_products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Featured product delete error:', error)
      return NextResponse.json(
        { success: false, error: '추천 상품 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '추천 상품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Featured product delete API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 