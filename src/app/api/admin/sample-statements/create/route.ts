import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// POST - 샘플 명세서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { 
      customer_id, 
      items, 
      admin_notes,
      sample_type = 'photography', // 샘플은 무조건 무료 (촬영용)
      from_order_id = null 
    } = body

    if (!customer_id || (!items && !from_order_id)) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 고객 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({
        success: false,
        error: '고객 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 고객의 기본 배송지 조회
    const { data: shippingAddress, error: shippingError } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', customer_id)
      .eq('is_default', true)
      .single()

    // 기본 배송지가 없으면 첫 번째 배송지 사용
    let deliveryAddress = null
    if (!shippingAddress) {
      const { data: firstAddress } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('user_id', customer_id)
        .limit(1)
        .single()
      
      deliveryAddress = firstAddress
    } else {
      deliveryAddress = shippingAddress
    }

    // 임시 주문 생성 (샘플 명세서를 위한)
    const { data: tempOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: customer_id,
        order_number: `SAMPLE-${Date.now()}`,
        status: 'pending',
        total_amount: 0,
        shipping_name: deliveryAddress?.recipient_name || customer.representative_name || customer.company_name,
        shipping_phone: deliveryAddress?.phone || customer.phone,
        shipping_address: deliveryAddress?.address || customer.address || '',
        shipping_postal_code: deliveryAddress?.postal_code || '',
        notes: `샘플 명세서용 임시 주문 - ${sample_type === 'photography' ? '촬영용' : '판매용'}`
      })
      .select()
      .single()

    if (orderError) {
      console.error('Temp order creation error:', orderError)
      return NextResponse.json({
        success: false,
        error: '임시 주문 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 통합 샘플 번호 생성 (하나의 명세서에 대한 대표 번호)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase()
    const mainSampleNumber = `SP-${today}-${randomSuffix}`

    // 21일 후 반납 예정일 계산
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 21)

    // 샘플 명세서 생성 (실제 스키마에 맞게)
    const { data: statement, error: statementError } = await supabase
      .from('sample_statements')
      .insert({
        order_id: tempOrder.id,
        sample_type: 'photo', // 샘플은 무조건 무료 (촬영용)
        status: 'pending',
        total_amount: 0,
        admin_notes,
        items: items || []
      })
      .select()
      .single()

    if (statementError) {
      console.error('Sample statement creation error:', statementError)
      return NextResponse.json({
        success: false,
        error: '샘플 명세서 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 샘플 아이템들을 samples 테이블에 개별 생성 (각각 고유한 샘플 번호 사용)
    let totalAmount = 0
    const samplePromises = items.map(async (item: any, index: number) => {
      // 샘플은 무료 제공이므로 가격은 0원
      const unitPrice = 0
      const totalPrice = 0
      
      // 반납 기간 내 미반납 시 차감할 마일리지 금액 (실제 상품 가격)
      const penaltyAmount = item.unit_price || 0

      // 각 샘플 아이템마다 고유한 번호 생성
      const itemSampleNumber = `${mainSampleNumber}-${String(index + 1).padStart(2, '0')}`

      console.log(`Creating sample ${index + 1}:`, {
        sample_number: itemSampleNumber,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        penaltyAmount
      })

      const { data, error } = await supabase
        .from('samples')
        .insert({
          sample_number: itemSampleNumber, // 각 아이템마다 고유한 번호
          customer_id: customer_id,
          customer_name: customer.company_name || customer.representative_name,
          product_id: item.product_id,
          product_name: item.product_name,
          product_options: `색상: ${item.color || '기본'}, 사이즈: ${item.size || 'FREE'}`,
          quantity: item.quantity,
          sample_type: 'photography', // 샘플은 무조건 무료 (촬영용)
          charge_amount: penaltyAmount, // 미반납 시 차감할 금액
          status: 'pending',
          due_date: dueDate.toISOString().split('T')[0],
          delivery_address: deliveryAddress ? 
            `${deliveryAddress.address} (${deliveryAddress.recipient_name}, ${deliveryAddress.phone})` : 
            customer.address,
          admin_notes: admin_notes || `샘플 ${index + 1} - 반납기한: ${dueDate.toISOString().split('T')[0]} (미반납시 ₩${penaltyAmount.toLocaleString()} 차감)`
        })
        .select()

      if (error) {
        console.error(`Sample creation error for item ${index + 1}:`, error)
        throw error
      }

      console.log(`Sample ${index + 1} created successfully:`, data)
      return data
    })

    let createdSamples = []
    try {
      console.log(`Creating ${items.length} samples with number: ${mainSampleNumber}`)
      createdSamples = await Promise.all(samplePromises)
      console.log(`Successfully created ${createdSamples.length} samples`)
    } catch (error) {
      console.error('Sample creation error:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 재고 변동 이력 기록 (샘플 출고)
    try {
      const stockMovements = createdSamples.flat().map(sample => ({
        product_id: sample.product_id,
        movement_type: 'sample_out',
        quantity: -sample.quantity, // 음수 (출고)
        reference_id: sample.id,
        reference_type: 'sample',
        notes: `샘플 출고: ${sample.sample_number} (촬영용 샘플 발송)`,
        created_at: new Date().toISOString()
      }))

      const { error: stockError } = await supabase
        .from('stock_movements')
        .insert(stockMovements)

      if (stockError) {
        console.error('Stock movements insert error:', stockError)
        // 재고 이력 실패는 경고만 하고 계속 진행
      }

      // 상품 재고 수량도 차감
      for (const sample of createdSamples.flat()) {
        // 현재 재고 조회
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', sample.product_id)
          .single()

        if (productError) {
          console.error(`Product fetch error for ${sample.product_id}:`, productError)
          continue
        }

        // 재고 차감
        const newStockQuantity = Math.max(0, (product.stock_quantity || 0) - sample.quantity)
        const { error: stockUpdateError } = await supabase
          .from('products')
          .update({ stock_quantity: newStockQuantity })
          .eq('id', sample.product_id)

        if (stockUpdateError) {
          console.error(`Product stock update error for ${sample.product_id}:`, stockUpdateError)
        }
      }
    } catch (error) {
      console.error('Stock movement recording error:', error)
      // 재고 이력 실패는 경고만 하고 계속 진행
    }

    // 명세서 총액은 0원 (무료 제공)
    const { error: updateError } = await supabase
      .from('sample_statements')
      .update({
        total_amount: 0
      })
      .eq('id', statement.id)

    if (updateError) {
      console.error('Sample statement update error:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: `샘플 명세서가 생성되었습니다. (샘플번호: ${mainSampleNumber}, 반납기한: ${dueDate.toISOString().split('T')[0]})`,
      data: {
        statement,
        sample_number: mainSampleNumber,
        total_items: items.length,
        total_amount: 0, // 무료 제공
        due_date: dueDate.toISOString().split('T')[0],
        penalty_info: `반납 기한 내 미반납 시 마일리지 차감`
      }
    })

  } catch (error) {
    console.error('Sample statement creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 