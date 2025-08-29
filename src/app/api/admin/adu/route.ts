import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - ADU 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'adu7'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    const supabase = createClient()
    
    // 날짜 계산 (UTC 기준으로 계산)
    const now = new Date()
    
    // UTC 기준으로 계산 (데이터베이스가 UTC로 저장되어 있음)
    const date7 = new Date(now)
    date7.setDate(date7.getDate() - 7)
    
    const date30 = new Date(now)
    date30.setDate(date30.getDate() - 30)
    
    const date60 = new Date(now)
    date60.setDate(date60.getDate() - 60)
    
    const date180 = new Date(now)
    date180.setDate(date180.getDate() - 180)

    console.log('🔍 ADU 계산 기간:', {
      현재시간: now.toISOString(),
      '7일전': date7.toISOString(),
      '30일전': date30.toISOString(),
      '60일전': date60.toISOString(),
      '180일전': date180.toISOString()
    })

    // 1. 먼저 모든 상품 정보 조회
    let productsQuery = supabase
      .from('products')
      .select(`
        id,
        code,
        name
      `)
      .eq('is_active', true)

    if (search) {
      productsQuery = productsQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }

    // 카테고리 필터는 제거 (카테고리 테이블 없음)

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('상품 조회 오류:', productsError)
      return NextResponse.json({
        success: false,
        error: '상품 데이터 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          totalItems: 0,
          searchTerm: search,
          category: 'all', // 카테고리 파라미터 제거
          sortBy: sortBy,
          sortOrder: sortOrder
        }
      })
    }

    const productIds = products.map(p => p.id)

    // 2. 주문 아이템 데이터 조회 (각 기간별로)
    const [orderData7, orderData30, orderData60, orderData180] = await Promise.all([
      // 7일 데이터 (최근 7일)
      supabase
        .from('order_items')
        .select('product_id, color, size, quantity, orders!order_items_order_id_fkey(created_at)')
        .in('product_id', productIds)
        .gte('orders.created_at', date7.toISOString()),
      
      // 30일 데이터 (최근 30일)
      supabase
        .from('order_items')
        .select('product_id, color, size, quantity, orders!order_items_order_id_fkey(created_at)')
        .in('product_id', productIds)
        .gte('orders.created_at', date30.toISOString()),
      
      // 60일 데이터 (최근 60일)
      supabase
        .from('order_items')
        .select('product_id, color, size, quantity, orders!order_items_order_id_fkey(created_at)')
        .in('product_id', productIds)
        .gte('orders.created_at', date60.toISOString()),
      
      // 180일 데이터 (최근 180일)
      supabase
        .from('order_items')
        .select('product_id, color, size, quantity, orders!order_items_order_id_fkey(created_at)')
        .in('product_id', productIds)
        .gte('orders.created_at', date180.toISOString())
    ])

    // 3. 차감 명세서 데이터 조회 (각 기간별로)
    const [deductionData7, deductionData30, deductionData60, deductionData180] = await Promise.all([
      // 7일 데이터 (최근 7일)
      supabase
        .from('deduction_statements')
        .select('items, created_at')
        .gte('created_at', date7.toISOString())
        .eq('status', 'completed'),
      
      // 30일 데이터 (최근 30일)
      supabase
        .from('deduction_statements')
        .select('items, created_at')
        .gte('created_at', date30.toISOString())
        .eq('status', 'completed'),
      
      // 60일 데이터 (최근 60일)
      supabase
        .from('deduction_statements')
        .select('items, created_at')
        .gte('created_at', date60.toISOString())
        .eq('status', 'completed'),
      
      // 180일 데이터 (최근 180일)
      supabase
        .from('deduction_statements')
        .select('items, created_at')
        .gte('created_at', date180.toISOString())
        .eq('status', 'completed')
    ])

    if (orderData7.error || orderData30.error || orderData60.error || orderData180.error) {
      console.error('주문 데이터 조회 오류:', { orderData7: orderData7.error, orderData30: orderData30.error, orderData60: orderData60.error, orderData180: orderData180.error })
      return NextResponse.json({
        success: false,
        error: '주문 데이터 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    if (deductionData7.error || deductionData30.error || deductionData60.error || deductionData180.error) {
      console.error('차감 명세서 데이터 조회 오류:', { deductionData7: deductionData7.error, deductionData30: deductionData30.error, deductionData60: deductionData60.error, deductionData180: deductionData180.error })
      return NextResponse.json({
        success: false,
        error: '차감 명세서 데이터 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    console.log('📊 기간별 주문 데이터 개수:', {
      '7일': orderData7.data?.length || 0,
      '30일': orderData30.data?.length || 0,
      '60일': orderData60.data?.length || 0,
      '180일': orderData180.data?.length || 0
    })

    console.log('📊 기간별 차감 명세서 데이터 개수:', {
      '7일': deductionData7.data?.length || 0,
      '30일': deductionData30.data?.length || 0,
      '60일': deductionData60.data?.length || 0,
      '180일': deductionData180.data?.length || 0
    })

    // 3. 데이터 집계 및 ADU 계산
    const aduMap = new Map<string, any>()

    // 각 상품의 옵션별로 초기화
    products.forEach(product => {
      // 해당 상품의 모든 주문 아이템에서 고유한 색상/사이즈 조합 찾기
      const allItems = [
        ...(orderData180.data || []).filter(item => item.product_id === product.id)
      ]
      
      const uniqueOptions = new Set<string>()
      allItems.forEach(item => {
        if (item.color && item.size) {
          uniqueOptions.add(`${item.color}|${item.size}`)
        }
      })

      uniqueOptions.forEach(option => {
        const [color, size] = option.split('|')
        const key = `${product.id}|${color}|${size}`
        aduMap.set(key, {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          color,
          size,
          total7: 0,
          total30: 0,
          total60: 0,
          total180: 0
        })
      })
    })

    // 각 기간별 데이터 집계 (날짜 필터링 포함)
    const aggregateData = (data: any[], period: string, startDate: Date) => {
      if (!data) return
      
      data.forEach(item => {
        if (!item.color || !item.size || !item.orders?.created_at) return
        
        // 주문 생성일이 해당 기간에 포함되는지 확인
        const orderDate = new Date(item.orders.created_at)
        if (orderDate >= startDate && orderDate <= now) {
          const key = `${item.product_id}|${item.color}|${item.size}`
          if (aduMap.has(key)) {
            const existing = aduMap.get(key)
            existing[`total${period}`] += item.quantity || 0
          }
        }
      })
    }

    aggregateData(orderData7.data, '7', date7)
    aggregateData(orderData30.data, '30', date30)
    aggregateData(orderData60.data, '60', date60)
    aggregateData(orderData180.data, '180', date180)

    // 차감 명세서 데이터 집계
    const aggregateDeductionData = (data: any[], period: string, startDate: Date) => {
      if (!data) return
      
      data.forEach(statement => {
        if (!statement.items || !Array.isArray(statement.items)) return
        
        statement.items.forEach((item: any) => {
          if (!item.product_name || !item.color || !item.size || !statement.created_at) return
          
          // product_name으로 상품 ID 찾기
          const product = products.find(p => p.name === item.product_name)
          if (!product) return
          
          // 차감 명세서 생성일이 해당 기간에 포함되는지 확인
          const statementDate = new Date(statement.created_at)
          if (statementDate >= startDate && statementDate <= now) {
            const key = `${product.id}|${item.color}|${item.size}`
            if (aduMap.has(key)) {
              const existing = aduMap.get(key)
              existing[`total${period}`] += item.deduction_quantity || 0
            }
          }
        })
      })
    }

    aggregateDeductionData(deductionData7.data, '7', date7)
    aggregateDeductionData(deductionData30.data, '30', date30)
    aggregateDeductionData(deductionData60.data, '60', date60)
    aggregateDeductionData(deductionData180.data, '180', date180)

    // ADU 계산 및 결과 변환
    let aduData = Array.from(aduMap.values())
      .filter(item => item.total7 > 0 || item.total30 > 0 || item.total60 > 0 || item.total180 > 0)
      .map(item => ({
        ...item,
        adu7: item.total7 / 7,
        adu30: item.total30 / 30,
        adu60: item.total60 / 60,
        adu180: item.total180 / 180
      }))

    // 정렬
    aduData.sort((a, b) => {
      const aVal = sortBy === 'adu7' ? a.adu7 :
                   sortBy === 'adu30' ? a.adu30 :
                   sortBy === 'adu60' ? a.adu60 :
                   sortBy === 'adu180' ? a.adu180 : a.adu7
      
      const bVal = sortBy === 'adu7' ? b.adu7 :
                   sortBy === 'adu30' ? b.adu30 :
                   sortBy === 'adu60' ? b.adu60 :
                   sortBy === 'adu180' ? b.adu180 : b.adu7

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

    console.log(`✅ ADU 데이터 조회 완료: ${aduData.length}건`)

    return NextResponse.json({
      success: true,
      data: aduData,
      summary: {
        totalItems: aduData.length,
        searchTerm: search,
        category: 'all', // 카테고리 파라미터 제거
        sortBy: sortBy,
        sortOrder: sortOrder
      }
    })

  } catch (error) {
    console.error('ADU API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 