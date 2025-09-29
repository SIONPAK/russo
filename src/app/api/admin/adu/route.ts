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
        name,
        inventory_options
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

    // 2. 주문 아이템 데이터 조회 (각 기간별로) - 페이지네이션으로 모든 데이터 가져오기
    console.log('🔍 ADU 주문 데이터 페이지네이션으로 조회 시작...')
    
    const fetchOrderData = async (startDate: Date, period: string) => {
      let allData: any[] = []
      let page = 0
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('order_items')
          .select('product_id, color, size, quantity, shipped_quantity, orders!order_items_order_id_fkey(created_at, order_type, status)')
          .in('product_id', productIds)
          .gte('orders.created_at', startDate.toISOString())
          .neq('orders.order_type', 'sample')
          .not('shipped_quantity', 'is', null)
          .gt('shipped_quantity', 0)
          .range(page * limit, (page + 1) * limit - 1)

        if (error) {
          console.error(`ADU 주문 데이터 ${period} 페이지 ${page} 조회 오류:`, error)
          break
        }

        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          console.log(`🔍 ADU 주문 데이터 ${period} 페이지 ${page + 1}: ${pageData.length}건 조회 (총 ${allData.length}건)`)
          page++
          
          if (pageData.length < limit) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      console.log(`🔍 ADU 주문 데이터 ${period} 전체 조회 완료: ${allData.length}건`)
      return { data: allData, error: null }
    }

    const [orderData7, orderData30, orderData60, orderData180] = await Promise.all([
      fetchOrderData(date7, '7일'),
      fetchOrderData(date30, '30일'),
      fetchOrderData(date60, '60일'),
      fetchOrderData(date180, '180일')
    ])

    // 3. 차감 명세서 데이터 조회 (각 기간별로) - 페이지네이션으로 모든 데이터 가져오기
    console.log('🔍 ADU 차감명세서 데이터 페이지네이션으로 조회 시작...')
    
    const fetchDeductionData = async (startDate: Date, period: string) => {
      let allData: any[] = []
      let page = 0
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('deduction_statements')
          .select('items, created_at')
          .gte('created_at', startDate.toISOString())
          .eq('status', 'completed')
          .range(page * limit, (page + 1) * limit - 1)

        if (error) {
          console.error(`ADU 차감명세서 데이터 ${period} 페이지 ${page} 조회 오류:`, error)
          break
        }

        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          console.log(`🔍 ADU 차감명세서 데이터 ${period} 페이지 ${page + 1}: ${pageData.length}건 조회 (총 ${allData.length}건)`)
          page++
          
          if (pageData.length < limit) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      console.log(`🔍 ADU 차감명세서 데이터 ${period} 전체 조회 완료: ${allData.length}건`)
      return { data: allData, error: null }
    }

    const [deductionData7, deductionData30, deductionData60, deductionData180] = await Promise.all([
      fetchDeductionData(date7, '7일'),
      fetchDeductionData(date30, '30일'),
      fetchDeductionData(date60, '60일'),
      fetchDeductionData(date180, '180일')
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

    console.log('📊 기간별 주문 데이터 개수 (샘플 제외, 출고 수량만):', {
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

    // 각 상품의 옵션별로 초기화 - 모든 재고 옵션을 표시
    console.log('🔍 상품 데이터 확인:', products.length, '개')
    
    products.forEach((product: any) => {
      console.log(`📦 상품: ${product.name} (${product.code})`)
      console.log(`   - inventory_options:`, product.inventory_options)
      
      // 1. 재고 데이터에서 모든 옵션 조합 가져오기
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        console.log(`   - 재고 옵션 ${product.inventory_options.length}개 발견`)
        
        product.inventory_options.forEach((option: any) => {
          if (option.color && option.size) {
            const key = `${product.id}|${option.color}|${option.size}`
            const currentStock = option.stock_quantity || 0
            
            console.log(`   - 옵션: ${option.color}/${option.size}, 재고: ${currentStock}`)
            
            aduMap.set(key, {
              productId: product.id,
              productCode: product.code,
              productName: product.name,
              color: option.color,
              size: option.size,
              currentStock: currentStock,
              total7: 0,
              total30: 0,
              total60: 0,
              total180: 0
            })
          }
        })
      } else {
        console.log(`   - inventory_options 없음 또는 배열 아님`)
      }
      
      // 2. 주문 데이터에서 추가 옵션 조합 찾기 (재고에 없는 경우)
      const allItems = (orderData180.data || []).filter(item => item.product_id === product.id)
      console.log(`   - 주문 데이터: ${allItems.length}개`)
      
      allItems.forEach(item => {
        if (item.color && item.size) {
          const key = `${product.id}|${item.color}|${item.size}`
          // 이미 재고 데이터에 있는 경우는 건너뛰기
          if (!aduMap.has(key)) {
            console.log(`   - 주문만 있는 옵션: ${item.color}/${item.size}`)
            aduMap.set(key, {
              productId: product.id,
              productCode: product.code,
              productName: product.name,
              color: item.color,
              size: item.size,
              currentStock: 0, // 주문만 있고 재고는 없는 경우
              total7: 0,
              total30: 0,
              total60: 0,
              total180: 0
            })
          }
        }
      })
    })
    
    console.log('📊 aduMap 크기:', aduMap.size)
    console.log('📊 aduMap 샘플 데이터:', Array.from(aduMap.entries()).slice(0, 3))

    // 각 기간별 데이터 집계 (날짜 필터링 포함) - 샘플 주문 제외, 실제 출고 수량 사용
    const aggregateData = (data: any[], period: string, startDate: Date) => {
      if (!data) return
      
      data.forEach(item => {
        if (!item.color || !item.size || !item.orders?.created_at) return
        
        // 샘플 주문 제외 확인
        if (item.orders.order_type === 'sample') return
        
        // 주문 생성일이 해당 기간에 포함되는지 확인
        const orderDate = new Date(item.orders.created_at)
        if (orderDate >= startDate && orderDate <= now) {
          const key = `${item.product_id}|${item.color}|${item.size}`
          if (aduMap.has(key)) {
            const existing = aduMap.get(key)
            // 실제 출고 수량 사용 (shipped_quantity가 있으면 그것을, 없으면 quantity 사용)
            const quantity = item.shipped_quantity || item.quantity || 0
            existing[`total${period}`] += quantity
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
      .map(item => ({
        ...item,
        adu7: item.total7 / 7,
        adu30: item.total30 / 30,
        adu60: item.total60 / 60,
        adu180: item.total180 / 180
      }))
    
    console.log('📊 최종 ADU 데이터:', aduData.length, '개')
    console.log('📊 재고 샘플:', aduData.slice(0, 3).map(item => ({
      product: item.productName,
      color: item.color,
      size: item.size,
      stock: item.currentStock
    })))

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

    console.log(`✅ ADU 데이터 조회 완료: ${aduData.length}건 (차감명세서 + 출고처리된 주문만 포함, 샘플주문 제외)`)

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