import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 샘플 테스트 데이터 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 먼저 사용자와 상품 데이터 확인
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, company_name, representative_name')
      .limit(5)

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .limit(5)

    if (usersError || productsError || !users || !products || users.length === 0 || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: '사용자 또는 상품 데이터가 없습니다. 먼저 사용자와 상품을 등록해주세요.'
      }, { status: 400 })
    }

    // 테스트 샘플 데이터 생성
    const testSamples = []
    const statuses = ['pending', 'shipped', 'returned', 'charged']
    const sampleTypes = ['photography', 'sales']
    const colors = ['블랙', '화이트', '그레이', '네이비', '베이지']
    const sizes = ['FREE', 'S', 'M', 'L', 'XL']

    for (let i = 0; i < 20; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const product = products[Math.floor(Math.random() * products.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const sampleType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)]
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size = sizes[Math.floor(Math.random() * sizes.length)]
      
      // 날짜를 랜덤하게 생성 (최근 30일 내)
      const createdDate = new Date()
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30))
      
      // 출고일 설정 (shipped 상태인 경우)
      let outgoingDate = null
      let shippedAt = null
      if (status === 'shipped' || status === 'returned' || status === 'charged') {
        outgoingDate = new Date(createdDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
        shippedAt = outgoingDate
      }

      // 배송완료일 설정 (returned나 charged 상태인 경우)
      let deliveredAt = null
      if (status === 'returned' || status === 'charged') {
        deliveredAt = new Date(outgoingDate!.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000)
      }

      // 반납일 설정 (returned 상태인 경우)
      let returnDate = null
      if (status === 'returned') {
        returnDate = new Date(deliveredAt!.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000)
      }

      // 결제일 설정 (charged 상태인 경우)
      let chargeDate = null
      let chargeAmount = 0
      if (status === 'charged') {
        chargeDate = new Date(deliveredAt!.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000)
        chargeAmount = sampleType === 'photography' ? 0 : product.price
      }

      const sampleNumber = `SP-${createdDate.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      
      testSamples.push({
        sample_number: sampleNumber,
        customer_id: user.id,
        customer_name: user.company_name,
        product_id: product.id,
        product_name: product.name,
        product_options: `색상: ${color}, 사이즈: ${size}`,
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3개
        outgoing_date: outgoingDate?.toISOString(),
        status: status,
        charge_amount: chargeAmount,
        charge_method: chargeAmount > 0 ? 'mileage' : null,
        notes: `테스트 샘플 ${i + 1}`,
        created_at: createdDate.toISOString(),
        updated_at: getKoreaTime(),
        sample_type: sampleType,
        due_date: outgoingDate ? new Date(outgoingDate.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString() : null,
        return_date: returnDate?.toISOString(),
        charge_date: chargeDate?.toISOString(),
        delivery_address: `${user.company_name} 주소`,
        tracking_number: status === 'shipped' ? `1234567890${i.toString().padStart(3, '0')}` : null,
        admin_notes: `관리자 메모 ${i + 1}`,
        approved_at: status !== 'pending' ? createdDate.toISOString() : null,
        shipped_at: shippedAt?.toISOString(),
        delivered_at: deliveredAt?.toISOString(),
        rejected_at: null
      })
    }

    // 샘플 데이터 삽입
    const { data: insertedSamples, error: insertError } = await supabase
      .from('samples')
      .insert(testSamples)
      .select()

    if (insertError) {
      console.error('Sample seed data insertion error:', insertError)
      return NextResponse.json({
        success: false,
        error: '샘플 테스트 데이터 생성에 실패했습니다.',
        details: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${testSamples.length}개의 샘플 테스트 데이터가 생성되었습니다.`,
      data: {
        created_count: testSamples.length,
        samples: insertedSamples
      }
    })

  } catch (error) {
    console.error('Sample seed API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

// DELETE - 모든 샘플 테스트 데이터 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 모든 샘플 데이터 삭제
    const { error: deleteError } = await supabase
      .from('samples')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 모든 데이터 삭제

    if (deleteError) {
      console.error('Sample data deletion error:', deleteError)
      return NextResponse.json({
        success: false,
        error: '샘플 데이터 삭제에 실패했습니다.',
        details: deleteError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '모든 샘플 테스트 데이터가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Sample delete API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
} 