import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// GET /api/products - 사용자용 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const filter = searchParams.get('filter') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at_desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const offset = (page - 1) * limit

    // 기본 쿼리 구성
    let query = supabase
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
        tags,
        description,
        inventory_options,
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
      `, { count: 'exact' })

    // 활성화된 상품만 조회 (include_inactive=true인 경우 비활성화된 상품도 포함)
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    // 검색 조건 적용
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }

    // 카테고리 필터 적용 (key로 필터링)
    if (category) {
      // 먼저 카테고리 key로 category_id를 찾아서 필터링
      const { data: categoryData } = await supabase
        .from('category_menus')
        .select('id')
        .eq('key', category)
        .single()

      if (categoryData) {
        query = query.eq('category_id', categoryData.id)
      }
    }

    // 특별 필터 적용
    if (filter === 'new') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      query = query.gte('created_at', thirtyDaysAgo.toISOString())
    } else if (filter === 'sale') {
      query = query.eq('is_on_sale', true)
    } else if (filter === 'featured') {
      query = query.eq('is_featured', true)
    }

    // 정렬 적용
    switch (sortBy) {
      case 'created_at_desc':
        query = query.order('created_at', { ascending: false })
        break
      case 'created_at_asc':
        query = query.order('created_at', { ascending: true })
        break
      case 'price_asc':
        query = query.order('price', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false })
        break
      case 'name_asc':
        query = query.order('name', { ascending: true })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1)

    const { data: products, error, count } = await query

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '상품 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 이미지 정렬 (각 상품별로)
    if (products) {
      products.forEach((product: any) => {
        if (product.images) {
          product.images.sort((a: any, b: any) => a.sort_order - b.sort_order)
        }
      })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 