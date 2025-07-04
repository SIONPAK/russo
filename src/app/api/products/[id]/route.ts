import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        code,
        price,
        sale_price,
        is_on_sale,
        is_featured,
        is_active,
        stock_quantity,
        inventory_options,
        tags,
        description,
        detailed_description,
        created_at,
        updated_at,
        category:category_menus(
          id,
          name,
          key
        ),
        images:product_images!product_images_product_id_fkey(
          id,
          image_url,
          alt_text,
          sort_order,
          is_main
        )
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Product detail fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    if (!product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    if (product.images) {
      product.images.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    return NextResponse.json({
      success: true,
      data: product
    })

  } catch (error) {
    console.error('Product detail API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
