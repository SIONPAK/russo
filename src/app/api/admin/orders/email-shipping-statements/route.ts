import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCurrentKoreanDateTime, getKoreaTime } from '@/shared/lib/utils'
import { sendShippingStatementEmail } from '@/shared/lib/email-utils'
import { generateShippingStatement } from '@/shared/lib/shipping-statement-utils'

// 출고 명세서 이메일 발송 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 주문 정보 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone,
          address,
          business_number
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          color,
          size,
          products!order_items_product_id_fkey (
            id,
            name,
            code,
            stock_quantity
          )
        )
      `)
      .in('id', orderIds)
      .in('status', ['confirmed', 'preparing', 'shipped'])

    if (orderError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '이메일 발송 가능한 주문이 없습니다.'
      }, { status: 404 })
    }

    // 이메일 발송을 위한 병렬 처리 함수
    const sendEmailBatch = async (order: any) => {
      try {
        // 고객 이메일 확인
        if (!order.users?.email) {
          return {
            success: false,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: '고객 이메일 주소가 없습니다.'
          }
        }

        // 실제 출고된 상품만 필터링 (shipped_quantity가 없으면 전체 수량으로 간주)
        const shippedItems = order.order_items.filter((item: any) => {
          const shippedQty = item.shipped_quantity || item.quantity || 0
          return shippedQty > 0
        })

        if (shippedItems.length === 0) {
          return {
            success: false,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: '출고된 상품이 없습니다.'
          }
        }

        // 출고 명세서 데이터 구성
        const statementData = {
          orderNumber: order.order_number,
          companyName: order.users.company_name,
          businessLicenseNumber: order.users.business_number,
          email: order.users.email,
          phone: order.users.phone,
          address: order.users.address,
          postalCode: order.users.postal_code || '',
          customerGrade: order.users.customer_grade || 'normal',
          shippedAt: order.shipped_at || new Date().toISOString(),
          items: shippedItems.map((item: any) => {
            const actualQuantity = item.shipped_quantity || item.quantity || 0
            return {
              productName: item.product_name,
              color: item.color,
              size: item.size,
              quantity: actualQuantity,
              unitPrice: item.unit_price,
              totalPrice: actualQuantity * item.unit_price
            }
          }),
          totalAmount: shippedItems.reduce((sum: number, item: any) => {
            const actualQuantity = item.shipped_quantity || item.quantity || 0
            return sum + (actualQuantity * item.unit_price)
          }, 0)
        }

        // 거래명세서 엑셀 생성 (템플릿 사용)
        const excelBuffer = await generateShippingStatement(statementData)

        // 실제 이메일 발송 (Nodemailer 사용)
        const emailResult = await sendShippingStatementEmail(
          order.users.email,
          order,
          excelBuffer
        )

        if (emailResult.success) {
          // 이메일 발송 성공 이력 기록
          await supabase
            .from('email_logs')
            .insert({
              order_id: order.id,
              recipient_email: order.users?.email,
              email_type: 'shipping_statement',
              subject: `[루소](으)로부터 [거래명세서](이)가 도착했습니다. - ${order.order_number}`,
              status: 'sent',
              message_id: emailResult.messageId,
              sent_at: new Date().toISOString()
            })



          return {
            success: true,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            customerEmail: order.users?.email,
            status: 'sent',
            messageId: emailResult.messageId,
            sentAt: new Date().toISOString()
          }
        } else {
          // 이메일 발송 실패 이력 기록
          await supabase
            .from('email_logs')
            .insert({
              order_id: order.id,
              recipient_email: order.users?.email,
              email_type: 'shipping_statement',
              subject: `[루소] 거래명세서 - ${order.order_number}`,
              status: 'failed',
              error_message: emailResult.error || '이메일 발송 실패'
            })

          return {
            success: false,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: emailResult.error || '이메일 발송 실패'
          }
        }

      } catch (error) {
        console.error(`Email sending error for order ${order.order_number}:`, error)
        return {
          success: false,
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.users?.company_name,
          error: error instanceof Error ? error.message : '이메일 발송 중 오류 발생'
        }
      }
    }

    // 병렬 처리 (배치 크기 제한: 5개씩)
    const batchSize = 5
    const emailResults: any[] = []
    const failedEmails: any[] = []

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(order => sendEmailBatch(order))
      )

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const emailResult = result.value
          if (emailResult.success) {
            emailResults.push({
              orderId: emailResult.orderId,
              orderNumber: emailResult.orderNumber,
              customerName: emailResult.customerName,
              customerEmail: emailResult.customerEmail,
              status: 'sent',
              messageId: emailResult.messageId,
              sentAt: emailResult.sentAt
            })
          } else {
            failedEmails.push({
              orderId: emailResult.orderId,
              orderNumber: emailResult.orderNumber,
              customerName: emailResult.customerName,
              error: emailResult.error
            })
          }
        } else {
          const order = batch[index]
          console.error(`Batch processing error for order ${order.order_number}:`, result.reason)
          failedEmails.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: '이메일 발송 중 오류 발생'
          })
        }
      })

      // 각 배치 간 잠시 대기 (SMTP 서버 부하 방지)
      if (i + batchSize < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: emailResults,
        failed: failedEmails,
        summary: {
          totalOrders: orders.length,
          successfulEmails: emailResults.length,
          failedEmails: failedEmails.length
        }
      },
      message: `이메일 발송 완료: ${emailResults.length}건 성공, ${failedEmails.length}건 실패`
    })

  } catch (error) {
    console.error('Email shipping statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// GET - 이메일 발송 이력 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const emailType = searchParams.get('type') || 'shipping_statement'

    let query = supabase
      .from('email_logs')
      .select(`
        *,
        orders!email_logs_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            company_name
          )
        )
      `)
      .eq('email_type', emailType)

    // 날짜 필터
    if (startDate) {
      query = query.gte('sent_at', startDate)
    }
    if (endDate) {
      query = query.lte('sent_at', endDate + 'T23:59:59')
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    query = query
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalItems: count || 0,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('Email logs error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 이력 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 