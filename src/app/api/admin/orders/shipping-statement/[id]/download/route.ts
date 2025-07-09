import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateShippingStatement } from '@/shared/lib/shipping-statement-utils'
import { getKoreaDate } from '@/shared/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const statementId = id

    // 출고 명세서 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        shipped_at,
        users!inner(
          company_name,
          business_license_number,
          email,
          phone,
          address,
          detailed_address,
          postal_code,
          customer_grade
        ),
        order_items!inner(
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          unit_price
        )
      `)
      .eq('id', statementId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ 
        success: false, 
        error: '출고 명세서를 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    // 모든 상품 포함 (미출고 상품도 품명과 규격 표시)
    const allItems = order.order_items

    // 출고 명세서 데이터 구성
    const statementData = {
      orderNumber: order.order_number,
      companyName: (order.users as any).company_name,
      businessLicenseNumber: (order.users as any).business_license_number,
      email: (order.users as any).email,
      phone: (order.users as any).phone,
      address: `${(order.users as any).address} ${(order.users as any).detailed_address}`,
      postalCode: (order.users as any).postal_code,
      customerGrade: (order.users as any).customer_grade,
      shippedAt: order.shipped_at || new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString(),
      items: allItems.map((item: any) => {
        const actualQuantity = item.shipped_quantity || 0
        const isUnshipped = actualQuantity === 0
        
        console.log('🔍 출고 명세서 다운로드 - 아이템 수량 확인:', {
          productName: item.product_name,
          shipped_quantity: item.shipped_quantity,
          quantity: item.quantity,
          actualQuantity,
          isUnshipped
        })
        
        return {
          productName: item.product_name,
          color: item.color || '기본',
          size: item.size || '',
          quantity: isUnshipped ? 0 : actualQuantity,
          unitPrice: isUnshipped ? 0 : item.unit_price,
          totalPrice: isUnshipped ? 0 : actualQuantity * item.unit_price
        }
      }),
      totalAmount: allItems.reduce((sum: number, item: any) => {
        const actualQuantity = item.shipped_quantity || 0
        return sum + (actualQuantity * item.unit_price)
      }, 0)
    }

    // 엑셀 파일 생성
    const excelBuffer = await generateShippingStatement(statementData)
    const base64Data = excelBuffer.toString('base64')
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`

            const koreaDate = getKoreaDate()
    const filename = `출고명세서_${statementData.companyName}_${statementData.orderNumber}_${koreaDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: dataUrl,
        filename: filename
      }
    })

  } catch (error) {
    console.error('Statement download error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '출고 명세서 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 