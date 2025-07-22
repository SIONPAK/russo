import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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

    // 통합 샘플 번호 생성 (하나의 명세서에 대한 대표 번호) - 중복 방지
    const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
    const today = koreaTime.toISOString().split('T')[0].replace(/-/g, '')
    let mainSampleNumber = ''
    let attempts = 0
    const maxAttempts = 10

    // 중복되지 않는 샘플 번호 생성
    while (attempts < maxAttempts) {
      const timestamp = Date.now().toString().slice(-6) // 마지막 6자리
      const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase()
      mainSampleNumber = `SP-${today}-${timestamp}${randomSuffix}`
      
      // 중복 체크
      const { data: existingSample, error: checkError } = await supabase
        .from('samples')
        .select('id')
        .like('sample_number', `${mainSampleNumber}%`)
        .limit(1)
        .single()
      
      if (checkError && checkError.code === 'PGRST116') {
        // 데이터가 없음 (중복 없음)
        break
      } else if (checkError) {
        console.error('Sample number check error:', checkError)
        attempts++
        continue
      } else {
        // 중복 발견, 다시 시도
        attempts++
        continue
      }
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json({
        success: false,
        error: '샘플 번호 생성에 실패했습니다. 다시 시도해주세요.'
      }, { status: 500 })
    }

    // 21일 후 반납 예정일 계산 (한국 시간 기준)
    const dueDate = new Date(koreaTime.getTime() + (21 * 24 * 60 * 60 * 1000)) // 21일 후

    // 샘플 명세서 생성 (실제 스키마에 맞게) - statement_number 명시적으로 설정
    const statementNumber = `SS-${today}-${Date.now().toString().slice(-6)}`
    const { data: statement, error: statementError } = await supabase
      .from('sample_statements')
      .insert({
        statement_number: statementNumber, // 명시적으로 설정하여 트리거 중복 방지
        order_id: tempOrder.id,
        sample_type: 'photo', // 샘플은 무조건 무료 (촬영용)
        status: 'pending',
        total_amount: 0,
        admin_notes,
        items: items || [],
        created_at: getKoreaTime(),
        updated_at: getKoreaTime()
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

    // 샘플 아이템들을 samples 테이블에 순차 생성 (분할 방지)
    let totalAmount = 0
    const createdSamples = []

    console.log(`🔄 ${items.length}개 샘플을 그룹 ${mainSampleNumber}으로 순차 생성 시작`)

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      
      try {
        // 샘플은 무료 제공이지만, 미반납 시 차감할 금액은 실제 상품 가격
        const unitPrice = 0 // 샘플 제공 가격 (무료)
        const totalPrice = 0 // 샘플 제공 총액 (무료)
        
        // 미반납 시 차감할 마일리지 금액 (실제 상품 가격 × 수량)
        const penaltyAmount = (item.unit_price || 0) * item.quantity

        // 각 아이템마다 고유한 번호 생성 (UNIQUE 제약조건 때문)
        const itemSampleNumber = `${mainSampleNumber}-${String(index + 1).padStart(2, '0')}`

        console.log(`📦 샘플 ${index + 1}/${items.length} 생성 중:`, {
          sample_number: itemSampleNumber,
          group_number: mainSampleNumber,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          penaltyAmount
        })

        const { data, error } = await supabase
          .from('samples')
          .insert({
            sample_number: itemSampleNumber, // 개별 고유 번호
            customer_id: customer_id,
            customer_name: customer.company_name || customer.representative_name,
            product_id: item.product_id,
            product_name: item.product_name,
            product_options: `색상: ${item.color || '기본'}, 사이즈: ${item.size || 'FREE'}`,
            quantity: item.quantity,
            sample_type: 'photography', // 샘플은 무조건 무료 (촬영용)
            charge_amount: penaltyAmount, // 미반납 시 차감할 금액 (실제 상품 가격 × 수량)
            status: 'pending',
            due_date: dueDate.toISOString().split('T')[0],
            delivery_address: deliveryAddress ? 
              `${deliveryAddress.address} (${deliveryAddress.recipient_name}, ${deliveryAddress.phone})` : 
              customer.address,
            admin_notes: admin_notes || `샘플 그룹 ${mainSampleNumber} (${index + 1}/${items.length}) - 반납기한: ${dueDate.toISOString().split('T')[0]} (미반납시 ₩${penaltyAmount.toLocaleString()} 차감)`,
            // 그룹 정보를 notes에 추가하여 그룹 관리
            notes: `GROUP:${mainSampleNumber}|ITEM:${index + 1}|TOTAL:${items.length}|PENALTY:${penaltyAmount}`,
            created_at: getKoreaTime(),
            updated_at: getKoreaTime()
          })
          .select()
          .single()

        if (error) {
          console.error(`❌ 샘플 ${index + 1} 생성 오류:`, error)
          throw error
        }

        console.log(`✅ 샘플 ${index + 1} 생성 완료:`, data.sample_number)
        totalAmount += penaltyAmount // 총 미반납 시 차감 금액 누적
        createdSamples.push(data)

        // 순차 처리를 위한 짧은 지연 (분할 방지)
        if (index < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        console.error(`❌ 샘플 ${index + 1} 생성 실패:`, error)
        return NextResponse.json({
          success: false,
          error: `샘플 생성에 실패했습니다. (${index + 1}번째 아이템)`
        }, { status: 500 })
      }
    }

        console.log(`🎉 그룹 ${mainSampleNumber} 생성 완료: ${createdSamples.length}개 샘플`)

    // 💡 샘플은 재고 연동하지 않음 (재고 차감 및 이력 기록 제거)
    // 샘플 출고/회수는 팀장님이 별도 수동 관리

    // 명세서 총액을 미반납 시 차감할 총 금액으로 업데이트
    const { error: updateError } = await supabase
      .from('sample_statements')
      .update({
        total_amount: totalAmount // 미반납 시 차감할 총 금액
      })
      .eq('id', statement.id)

    if (updateError) {
      console.error('Sample statement update error:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: `샘플 명세서가 생성되었습니다. (그룹번호: ${mainSampleNumber}, 반납기한: ${dueDate.toISOString().split('T')[0]}, 미반납시 차감: ₩${totalAmount.toLocaleString()})`,
      data: {
        statement,
        sample_number: mainSampleNumber,
        total_items: items.length,
        total_amount: totalAmount, // 미반납 시 차감할 총 금액
        due_date: dueDate.toISOString().split('T')[0],
        penalty_info: `반납 기한 내 미반납 시 총 ₩${totalAmount.toLocaleString()} 마일리지 차감 (그룹 단위 관리)`
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