import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { UpdateProductData } from '@/shared/types'

// GET - 특정 상품 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const { id } = await params

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        category:category_menus(id, name, key),
        images:product_images(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Product fetch error:', error)
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product
    })

  } catch (error) {
    console.error('Product fetch API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT - 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const { id } = await params
    const body = await request.json()

    const {
      name,
      code,
      price,
      description,
      category_id,
      is_featured,
      is_on_sale,
      sale_price,
      stock_quantity,
      min_order_quantity,
      max_order_quantity,
      is_active,
      tags,
      images // 이미지 배열
    } = body

    // 필수 필드 검증
    if (!name || !code || !price || !category_id) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 다른 상품에서 같은 코드 사용 중인지 확인
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('code', code)
      .neq('id', id)
      .single()

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 상품 코드입니다.' },
        { status: 400 }
      )
    }

    // 상품 정보 업데이트
    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        code,
        price,
        description,
        category_id,
        is_featured,
        is_on_sale,
        sale_price: is_on_sale ? sale_price : null,
        stock_quantity,
        min_order_quantity,
        max_order_quantity,
        is_active,
        tags,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Product update error:', error)
      return NextResponse.json(
        { success: false, error: '상품 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 이미지 처리 (기존 이미지 삭제 후 새 이미지 추가)
    if (images && Array.isArray(images)) {
      // 기존 이미지 삭제
      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', id)

      // 새 이미지 추가
      if (images.length > 0) {
        const imageInserts = images.map((img: any, index: number) => ({
          product_id: id,
          image_url: img.url,
          alt_text: img.alt || name,
          is_main: index === 0, // 첫 번째 이미지를 메인으로 설정
          order_index: index
        }))

        await supabase
          .from('product_images')
          .insert(imageInserts)
      }
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: '상품이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Product update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE - 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const { id } = await params

    // 먼저 관련된 이미지들 삭제
    await supabase
      .from('product_images')
      .delete()
      .eq('product_id', id)

    // 상품 삭제
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Product delete error:', error)
      return NextResponse.json(
        { success: false, error: '상품 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Product delete API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 