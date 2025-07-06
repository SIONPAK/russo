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
      sale_price,
      description,
      detailed_description,
      category_id,
      is_featured,
      is_on_sale,
      is_active,
      stock_quantity,
      inventory_options,
      unit,
      sku,
      weight,
      dimensions,
      tags,
      meta_title,
      meta_description,
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

    // 재고 옵션이 있는 경우 총 재고량 계산
    const totalStockQuantity = inventory_options && inventory_options.length > 0
      ? inventory_options.reduce((sum: number, opt: any) => sum + opt.stock_quantity, 0)
      : stock_quantity || 0

    // 상품 정보 업데이트
    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        code,
        price: parseInt(String(price)) || 0,
        sale_price: is_on_sale ? parseInt(String(sale_price)) || 0 : null,
        description,
        detailed_description,
        category_id,
        is_featured: is_featured || false,
        is_on_sale: is_on_sale || false,
        is_active: is_active ?? true,
        stock_quantity: totalStockQuantity,
        inventory_options: inventory_options || [],
        unit: unit || '개',
        sku,
        weight,
        dimensions,
        tags: tags || [],
        meta_title,
        meta_description,
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

    // 이미지 처리 - 기존 이미지와 새 이미지를 비교하여 처리
    if (images && Array.isArray(images)) {
      // 기존 이미지 조회
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', id)

      // 기존 이미지 ID 목록
      const existingImageIds = (existingImages || []).map(img => img.id)
      
      // 새 이미지에서 유지할 이미지 ID 목록
      const keepImageIds = images
        .filter(img => img.id)
        .map(img => img.id)

      // 삭제할 이미지 ID 목록
      const deleteImageIds = existingImageIds.filter(id => !keepImageIds.includes(id))

      // 불필요한 이미지 삭제
      if (deleteImageIds.length > 0) {
        await supabase
          .from('product_images')
          .delete()
          .in('id', deleteImageIds)
      }

      // 새 이미지 추가 및 기존 이미지 업데이트
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        
        if (img.id) {
          // 기존 이미지 업데이트
          await supabase
            .from('product_images')
            .update({
              alt_text: img.altText || name,
              is_main: img.isMain || false,
              sort_order: img.sortOrder || i + 1
            })
            .eq('id', img.id)
        } else {
          // 새 이미지 추가
          await supabase
            .from('product_images')
            .insert({
              product_id: id,
              image_url: img.url,
              alt_text: img.altText || name,
              is_main: img.isMain || false,
              sort_order: img.sortOrder || i + 1
            })
        }
      }
    }

    // 업데이트된 상품 정보 다시 조회 (이미지 포함)
    const { data: updatedProduct } = await supabase
      .from('products')
      .select(`
        *,
        category:category_menus(id, name, key),
        images:product_images(*)
      `)
      .eq('id', id)
      .single()

    return NextResponse.json({
      success: true,
      data: updatedProduct,
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