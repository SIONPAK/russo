import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { UpdateProductData } from '@/shared/types'

// GET /api/admin/products/[id] - 개별 상품 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(
          id,
          name,
          key
        ),
        images:product_images(
          id,
          image_url,
          alt_text,
          sort_order,
          is_main
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: product
    })

  } catch (error) {
    console.error('Product fetch error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// PUT /api/admin/products/[id] - 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: UpdateProductData = await request.json()

    // 상품 존재 확인
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('id, code')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingProduct) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 상품 코드 중복 검사 (자신 제외)
    if (body.code && body.code !== existingProduct.code) {
      const { data: duplicateProduct } = await supabase
        .from('products')
        .select('id')
        .eq('code', body.code)
        .neq('id', params.id)
        .single()

      if (duplicateProduct) {
        return NextResponse.json({
          success: false,
          error: '이미 존재하는 상품 코드입니다.'
        }, { status: 400 })
      }
    }

    // 업데이트할 데이터 준비
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.detailed_description !== undefined) updateData.detailed_description = body.detailed_description
    if (body.category_id !== undefined) updateData.category_id = body.category_id
    if (body.code !== undefined) updateData.code = body.code
    if (body.price !== undefined) updateData.price = body.price
    if (body.sale_price !== undefined) updateData.sale_price = body.sale_price
    if (body.is_on_sale !== undefined) updateData.is_on_sale = body.is_on_sale
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.unit !== undefined) updateData.unit = body.unit
    if (body.sku !== undefined) updateData.sku = body.sku
    if (body.weight !== undefined) updateData.weight = body.weight
    if (body.dimensions !== undefined) updateData.dimensions = body.dimensions
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.meta_title !== undefined) updateData.meta_title = body.meta_title
    if (body.meta_description !== undefined) updateData.meta_description = body.meta_description

    // 재고 옵션 업데이트 및 총 재고량 재계산
    if (body.inventory_options !== undefined) {
      updateData.inventory_options = body.inventory_options
      // 총 재고량 재계산
      const totalStockQuantity = body.inventory_options.reduce((sum: number, opt: any) => sum + opt.stock_quantity, 0)
      updateData.stock_quantity = totalStockQuantity
    } else if (body.stock_quantity !== undefined) {
      updateData.stock_quantity = body.stock_quantity
    }

    updateData.updated_at = new Date().toISOString()

    // 상품 업데이트
    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        category:categories(
          id,
          name,
          key
        ),
        images:product_images(
          id,
          image_url,
          alt_text,
          sort_order,
          is_main
        )
      `)
      .single()

    if (error) {
      console.error('Product update error:', error)
      return NextResponse.json({
        success: false,
        error: '상품 수정에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: '상품이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Product update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// DELETE /api/admin/products/[id] - 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 상품 존재 확인
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('id', params.id)
      .single()

    if (fetchError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 주문에 사용된 상품인지 확인 (실제 주문 테이블이 있을 때)
    // const { data: orders } = await supabase
    //   .from('order_items')
    //   .select('id')
    //   .eq('product_id', params.id)
    //   .limit(1)

    // if (orders && orders.length > 0) {
    //   return NextResponse.json({
    //     success: false,
    //     error: '주문에 사용된 상품은 삭제할 수 없습니다.'
    //   }, { status: 400 })
    // }

    // 상품 이미지들 먼저 삭제
    const { data: images } = await supabase
      .from('product_images')
      .select('id, image_url')
      .eq('product_id', params.id)

    if (images && images.length > 0) {
      // Storage에서 이미지 파일들 삭제
      const filePaths = images.map(img => {
        const url = new URL(img.image_url)
        const pathParts = url.pathname.split('/')
        return pathParts.slice(-2).join('/') // products/filename
      })

      await supabase.storage
        .from('product-images')
        .remove(filePaths)

      // 데이터베이스에서 이미지 레코드들 삭제
      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', params.id)
    }

    // 상품 삭제
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Product delete error:', deleteError)
      return NextResponse.json({
        success: false,
        error: '상품 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Product delete API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 