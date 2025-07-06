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
      delivery_address, 
      admin_notes,
      sample_type = 'sales',
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

    // 명세서 번호 생성
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase()
    const statementNumber = `SS-${today}-${randomSuffix}`

    // 21일 후 반납 예정일 계산
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 21)

    // 샘플 명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('sample_statements')
      .insert({
        statement_number: statementNumber,
        customer_id,
        customer_name: customer.company_name || customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        business_number: customer.business_number,
        representative_name: customer.representative_name,
        delivery_address: delivery_address || customer.address,
        admin_notes,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending'
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

    let statementItems = []

    if (from_order_id) {
      // 주문에서 데이터 가져오기
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products!order_items_product_id_fkey (
            id,
            name,
            code,
            price
          )
        `)
        .eq('order_id', from_order_id)

      if (orderItemsError || !orderItems) {
        return NextResponse.json({
          success: false,
          error: '주문 아이템을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // 주문 아이템을 샘플 명세서 아이템으로 변환
      const itemsToInsert = orderItems.map(item => {
        const unitPrice = sample_type === 'photography' ? 0 : (item.products?.price || item.unit_price)
        const totalPrice = unitPrice * item.quantity
        const supplyAmount = totalPrice
        const taxAmount = Math.floor(supplyAmount * 0.1)

        return {
          statement_id: statement.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.products?.code || '',
          product_options: `색상: ${item.color || '기본'}, 사이즈: ${item.size || 'FREE'}`,
          color: item.color || '기본',
          size: item.size || 'FREE',
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          supply_amount: supplyAmount,
          tax_amount: taxAmount,
          sample_type,
          sample_number: `SP-${today}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
        }
      })

      const { data: insertedItems, error: itemsError } = await supabase
        .from('sample_statement_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        console.error('Sample statement items creation error:', itemsError)
        return NextResponse.json({
          success: false,
          error: '샘플 명세서 아이템 생성에 실패했습니다.'
        }, { status: 500 })
      }

      statementItems = insertedItems
    } else {
      // 직접 입력된 아이템들 처리
      const itemsToInsert = items.map((item: any) => {
        const unitPrice = sample_type === 'photography' ? 0 : item.unit_price
        const totalPrice = unitPrice * item.quantity
        const supplyAmount = totalPrice
        const taxAmount = Math.floor(supplyAmount * 0.1)

        return {
          statement_id: statement.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code || '',
          product_options: `색상: ${item.color || '기본'}, 사이즈: ${item.size || 'FREE'}`,
          color: item.color || '기본',
          size: item.size || 'FREE',
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          supply_amount: supplyAmount,
          tax_amount: taxAmount,
          sample_type,
          sample_number: `SP-${today}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
        }
      })

      const { data: insertedItems, error: itemsError } = await supabase
        .from('sample_statement_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        console.error('Sample statement items creation error:', itemsError)
        return NextResponse.json({
          success: false,
          error: '샘플 명세서 아이템 생성에 실패했습니다.'
        }, { status: 500 })
      }

      statementItems = insertedItems
    }

    // 총액 계산 및 업데이트
    const totalQuantity = statementItems.reduce((sum, item) => sum + item.quantity, 0)
    const totalAmount = statementItems.reduce((sum, item) => sum + item.total_price, 0)
    const supplyAmount = statementItems.reduce((sum, item) => sum + item.supply_amount, 0)
    const taxAmount = statementItems.reduce((sum, item) => sum + item.tax_amount, 0)

    const { error: updateError } = await supabase
      .from('sample_statements')
      .update({
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        supply_amount: supplyAmount,
        tax_amount: taxAmount
      })
      .eq('id', statement.id)

    if (updateError) {
      console.error('Sample statement update error:', updateError)
    }

    // 완성된 샘플 명세서 정보 조회
    const { data: finalStatement, error: finalError } = await supabase
      .from('sample_statements')
      .select(`
        *,
        sample_statement_items (
          *,
          products!sample_statement_items_product_id_fkey (
            id,
            name,
            code,
            price
          )
        )
      `)
      .eq('id', statement.id)
      .single()

    if (finalError) {
      console.error('Final statement query error:', finalError)
    }

    return NextResponse.json({
      success: true,
      message: '샘플 명세서가 생성되었습니다.',
      data: finalStatement || statement
    })

  } catch (error) {
    console.error('Sample statement creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 