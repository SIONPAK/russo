import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 추천상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'featured' // featured, popular
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const offset = (page - 1) * limit
    const supabase = createClient()

    let query = supabase
      .from('featured_products')
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
      `, { count: 'exact' })
      .eq('type', type)
      .order('order_index', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: featuredProducts, error, count } = await query

    if (error) {
      console.error('Featured products fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '추천상품 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: featuredProducts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })

  } catch (error) {
    console.error('Featured products API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 추천상품 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { product_id, type, order_index, is_active = true } = body

    // 필수 필드 검증
    if (!product_id || !type) {
      return NextResponse.json({
        success: false,
        error: '상품 ID와 타입이 필요합니다.'
      }, { status: 400 })
    }

    // 상품 존재 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 상품입니다.'
      }, { status: 400 })
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from('featured_products')
      .select('id')
      .eq('product_id', product_id)
      .eq('type', type)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: '이미 추가된 상품입니다.'
      }, { status: 400 })
    }

    // order_index 자동 설정
    let finalOrderIndex = order_index
    if (!finalOrderIndex) {
      const { data: maxOrder } = await supabase
        .from('featured_products')
        .select('order_index')
        .eq('type', type)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

      finalOrderIndex = (maxOrder?.order_index || 0) + 1
    }

    const { data: featuredProduct, error } = await supabase
      .from('featured_products')
      .insert({
        product_id,
        type,
        order_index: finalOrderIndex,
        is_active
      })
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
      console.error('Featured product creation error:', error)
      return NextResponse.json({
        success: false,
        error: '추천상품 추가에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: featuredProduct,
      message: '추천상품이 성공적으로 추가되었습니다.'
    })

  } catch (error) {
    console.error('Featured product creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// PUT - 추천상품 순서 일괄 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { items } = body // [{ id, order_index }]

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 데이터입니다.'
      }, { status: 400 })
    }

    // 각 아이템의 순서 업데이트
    const updatePromises = items.map(item => 
      supabase
        .from('featured_products')
        .update({ order_index: item.order_index })
        .eq('id', item.id)
    )

    const results = await Promise.all(updatePromises)
    
    // 오류 확인
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      console.error('Order update errors:', errors)
      return NextResponse.json({
        success: false,
        error: '순서 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '순서가 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Featured product order update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 