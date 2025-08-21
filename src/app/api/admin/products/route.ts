import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { CreateProductData, ProductFilters } from '@/shared/types'
import { getKoreaTime } from '@/shared/lib/utils'

// 서비스 키를 사용하는 관리자용 클라이언트 (RLS 우회)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : supabase // 서비스 키가 없으면 일반 클라이언트 사용

interface InventoryOption {
  color: string
  size: string
  stock_quantity: number
}

// GET /api/admin/products - 상품 목록 조회 (재고 정보 포함)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: ProductFilters = {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as any) || 'all',
      category: searchParams.get('category') || undefined,
      sort_by: (searchParams.get('sort_by') as any) || 'created_at',
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    }

    // 상품 데이터 조회 (재고 정보 포함한 뷰 사용)
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        code,
        stock_quantity,
        inventory_options,
        is_active,
        created_at,
        price,
        sale_price,
        is_on_sale,
        is_featured,
        tags,
        description,
        detailed_description,
        unit,
        sku,
        weight,
        dimensions,
        meta_title,
        meta_description,
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

    // 검색 필터
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%, code.ilike.%${filters.search}%`)
    }

    // 상태 필터
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        query = query.eq('is_active', true)
      } else if (filters.status === 'inactive') {
        query = query.eq('is_active', false)
      } else if (filters.status === 'out_of_stock') {
        query = query.eq('stock_quantity', 0)
      } else if (filters.status === 'low_stock') {
        query = query.lte('stock_quantity', 10).gt('stock_quantity', 0)
      }
    }

    // 정렬
    const sortColumn = filters.sort_by === 'stock' ? 'stock_quantity' : (filters.sort_by || 'created_at')
    const sortOrder = filters.sort_order === 'asc' ? true : false
    query = query.order(sortColumn, { ascending: sortOrder })

    // 페이지네이션
    const page = filters.page || 1
    const limit = filters.limit || 20
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: products, error } = await query

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '상품 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 총 개수 조회
    const { count: totalCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
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

// POST /api/admin/products - 상품 생성 (재고 관리 포함)
export async function POST(request: NextRequest) {
  try {
    const body: CreateProductData & { 
      inventory_options?: InventoryOption[]
      images?: Array<{
        id?: string
        image_url: string
        alt_text?: string
        is_main: boolean
        sort_order: number
      }>
    } = await request.json()

    // 필수 필드 검증
    if (!body.name || !body.code || !body.category_id || !body.price) {
      return NextResponse.json({
        success: false,
        error: '필수 필드를 모두 입력해주세요.'
      }, { status: 400 })
    }

    // 재고 옵션 검증
    if (!body.inventory_options || body.inventory_options.length === 0) {
      return NextResponse.json({
        success: false,
        error: '최소 하나의 재고 옵션을 추가해주세요.'
      }, { status: 400 })
    }

    // 상품 코드 중복 검사
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('code', body.code)
      .single()

    if (existingProduct) {
      return NextResponse.json({
        success: false,
        error: '이미 존재하는 상품 코드입니다.'
      }, { status: 400 })
    }

    // 새로운 재고 구조를 위한 inventory_options 변환
    const convertedInventoryOptions = body.inventory_options.map(opt => ({
      ...opt,
      physical_stock: Number(opt.stock_quantity) || 0, // 물리적 재고 (0이어도 반드시 포함)
      allocated_stock: 0, // 할당된 재고는 0으로 초기화
      stock_quantity: Number(opt.stock_quantity) || 0 // 가용재고 = 물리적재고 - 할당재고
    }))

    // 총 재고량 계산
    const totalStockQuantity = convertedInventoryOptions.reduce((sum, opt) => sum + opt.stock_quantity, 0)

    // 상품 생성
    const { data: product, error } = await supabase
      .from('products')
      .insert([{
        name: body.name,
        description: body.description,
        detailed_description: body.detailed_description,
        category_id: body.category_id,
        code: body.code,
        price: parseInt(String(body.price)) || 0,
        sale_price: body.is_on_sale ? parseInt(String(body.sale_price)) || 0 : null,
        is_on_sale: body.is_on_sale || false,
        is_featured: body.is_featured || false,
        is_active: body.is_active ?? true,
        stock_quantity: totalStockQuantity,
        inventory_options: convertedInventoryOptions,
        unit: body.unit || '개',
        sku: body.sku,
        weight: body.weight,
        dimensions: body.dimensions,
        tags: body.tags,
        meta_title: body.meta_title,
        meta_description: body.meta_description,
        created_at: getKoreaTime()
      }])
      .select(`
        *,
        category:category_menus(
          id,
          name,
          key
        )
      `)
      .single()

    if (error) {
      console.error('Product creation error:', error)
      return NextResponse.json({
        success: false,
        error: '상품 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 상품 이미지 저장
    let productImages = []
    if (body.images && body.images.length > 0) {
      const imageData = body.images.map(img => ({
        product_id: product.id,
        image_url: img.image_url,
        alt_text: img.alt_text || '',
        sort_order: img.sort_order,
        is_main: img.is_main
      }))

      const { data: images, error: imageError } = await supabaseAdmin
        .from('product_images')
        .insert(imageData)
        .select()

      if (imageError) {
        console.error('Product images creation error:', imageError)
        // 상품은 생성되었지만 이미지 저장 실패 시 상품 삭제
        await supabase.from('products').delete().eq('id', product.id)
        return NextResponse.json({
          success: false,
          error: '상품 이미지 저장에 실패했습니다.'
        }, { status: 500 })
      }

      productImages = images || []
    }

    // 🎯 성능 최적화: 재고 변동 이력 배치 INSERT
    if (totalStockQuantity > 0) {
      // 재고가 있는 옵션들의 변동 이력 데이터를 배열로 준비
      const movementDataArray = convertedInventoryOptions
        .filter(option => option.physical_stock > 0)
        .map(option => ({
          product_id: product.id,
          movement_type: 'initial_stock',
          quantity: option.physical_stock,
          color: option.color || null,
          size: option.size || null,
          notes: `상품 등록 시 초기 재고 (${option.color}/${option.size})`,
          created_at: getKoreaTime()
        }))

      if (movementDataArray.length > 0) {
        console.log(`📦 배치 재고 변동 이력 기록: ${movementDataArray.length}개`)
        
        // 배치로 한 번에 INSERT
        const { data: movementResults, error: movementError } = await supabase
          .from('stock_movements')
          .insert(movementDataArray)
          .select()
        
        if (movementError) {
          console.error(`배치 재고 변동 이력 기록 실패:`, movementError)
          // 재고 이력 기록 실패는 경고만 하고 계속 진행
        } else {
          console.log(`✅ 배치 재고 변동 이력 기록 성공: ${movementResults?.length || 0}개`)
        }
      }
    }

    // 상품에 이미지 정보 추가하여 반환
    const enrichedProduct = {
      ...product,
      images: productImages,
      total_stock: totalStockQuantity,
      stock_status: totalStockQuantity > 10 ? '충분' : totalStockQuantity > 0 ? '부족' : '품절'
    }

    return NextResponse.json({
      success: true,
      data: enrichedProduct,
      message: '상품이 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Product creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 