import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'
import { sendShippingStatementEmail } from '@/shared/lib/email-utils'
import * as XLSX from 'xlsx-js-style'

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

    const emailResults = []
    const failedEmails = []

    for (const order of orders) {
      try {
        // 고객 이메일 확인
        if (!order.users?.email) {
          failedEmails.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: '고객 이메일 주소가 없습니다.'
          })
          continue
        }

        // 실제 출고된 상품만 필터링
        const shippedItems = order.order_items.filter((item: any) => 
          item.shipped_quantity && item.shipped_quantity > 0
        )

        if (shippedItems.length === 0) {
          failedEmails.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: '출고된 상품이 없습니다.'
          })
          continue
        }

        // 거래명세서 엑셀 생성 (주문 관리 페이지와 동일한 형식)
        const excelBuffer = await generateReceiptExcel(order, shippedItems)

        // 실제 이메일 발송 (Nodemailer 사용)
        const emailResult = await sendShippingStatementEmail(
          order.users.email,
          order,
          excelBuffer
        )

        if (emailResult.success) {
          emailResults.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            customerEmail: order.users?.email,
            status: 'sent',
            messageId: emailResult.messageId,
            sentAt: new Date().toISOString()
          })

          // 이메일 발송 성공 이력 기록 (PostgreSQL NOW() 사용)
          await supabase
            .from('email_logs')
            .insert({
              order_id: order.id,
              recipient_email: order.users?.email,
              email_type: 'shipping_statement',
              subject: `[루소] 거래명세서 - ${order.order_number}`,
              status: 'sent',
              message_id: emailResult.messageId,
              sent_at: new Date().toISOString()
            })

        } else {
          failedEmails.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: emailResult.error || '이메일 발송 실패'
          })

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
        }

      } catch (error) {
        console.error(`Email sending error for order ${order.order_number}:`, error)
        failedEmails.push({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.users?.company_name,
          error: error instanceof Error ? error.message : '이메일 발송 중 오류 발생'
        })
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

// 거래명세서 엑셀 생성 (주문 관리 페이지와 동일한 형식)
async function generateReceiptExcel(order: any, shippedItems: any[]): Promise<Buffer> {
  try {
    // 템플릿 파일 로드
    const templatePath = '/templates/루소_영수증.xlsx'
    const templateUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${templatePath}`
    
    const templateResponse = await fetch(templateUrl)
    if (!templateResponse.ok) {
      throw new Error('템플릿 파일을 불러올 수 없습니다.')
    }

    const templateBuffer = await templateResponse.arrayBuffer()
    const workbook = XLSX.read(templateBuffer, { type: 'array' })
    const worksheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[worksheetName]

    // 색상별 상품 그룹화 (마이페이지와 동일한 로직)
    const groupItemsByColorAndProduct = (items: any[]) => {
      const grouped: { [key: string]: { 
        productName: string
        color: string
        totalQuantity: number
        unitPrice: number
        totalPrice: number
        supplyAmount: number
        taxAmount: number
      }} = {}
      
      items.forEach(item => {
        const color = item.color || '기본'
        const key = `${item.product_name}_${color}`
        
        if (grouped[key]) {
          grouped[key].totalQuantity += item.shipped_quantity
          grouped[key].totalPrice += item.unit_price * item.shipped_quantity
        } else {
          const totalPrice = item.unit_price * item.shipped_quantity
          const supplyAmount = totalPrice
          const taxAmount = Math.floor(supplyAmount * 0.1)
          
          grouped[key] = {
            productName: item.product_name,
            color,
            totalQuantity: item.shipped_quantity,
            unitPrice: item.unit_price,
            totalPrice,
            supplyAmount,
            taxAmount
          }
        }
      })
      
      // 합계 재계산
      Object.keys(grouped).forEach(key => {
        const item = grouped[key]
        item.supplyAmount = item.totalPrice
        item.taxAmount = Math.floor(item.supplyAmount * 0.1)
      })
      
      return Object.values(grouped)
    }

    // 숫자를 한글로 변환하는 함수
    const numberToKorean = (num: number): string => {
      const units = ['', '만', '억', '조']
      const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
      const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십']
      
      if (num === 0) return '영'
      
      let result = ''
      let unitIndex = 0
      
      while (num > 0) {
        const chunk = num % 10000
        if (chunk > 0) {
          let chunkStr = ''
          
          const thousands = Math.floor(chunk / 1000)
          const hundreds = Math.floor((chunk % 1000) / 100)
          const tensDigit = Math.floor((chunk % 100) / 10)
          const onesDigit = chunk % 10
          
          if (thousands > 0) {
            chunkStr += (thousands === 1 ? '' : digits[thousands]) + '천'
          }
          if (hundreds > 0) {
            chunkStr += (hundreds === 1 ? '' : digits[hundreds]) + '백'
          }
          if (tensDigit > 0) {
            chunkStr += tensDigit === 1 ? '십' : tens[tensDigit]
          }
          if (onesDigit > 0) {
            chunkStr += digits[onesDigit]
          }
          
          result = chunkStr + units[unitIndex] + result
        }
        
        num = Math.floor(num / 10000)
        unitIndex++
      }
      
      return result + '원정'
    }

    const groupedItems = groupItemsByColorAndProduct(shippedItems)
    
    // 20장 이상 무료배송 확인
    const totalShippedQuantity = shippedItems.reduce((sum: number, item: any) => 
      sum + item.shipped_quantity, 0
    )
    const actualShippingFee = totalShippedQuantity >= 20 ? 0 : (order.shipping_fee || 0)
    
    // 총 금액 계산
    const totalAmount = shippedItems.reduce((sum: number, item: any) => 
      sum + (item.unit_price * item.shipped_quantity), 0
    ) + actualShippingFee

    // 제목 서식 설정
    worksheet['!merges'] = worksheet['!merges'] || []
    worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
    
    worksheet['A1'] = {
      t: 's',
      v: '영수증(공급받는자)',
      s: {
        font: { bold: true, sz: 20 },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }
    
    // 행 높이 설정
    if (!worksheet['!rows']) {
      worksheet['!rows'] = []
    }
    worksheet['!rows'][0] = { hpt: 32 }
    
    // 기본 정보 입력
    worksheet['C3'] = { t: 's', v: new Date().toLocaleDateString('ko-KR') }
    worksheet['C4'] = { t: 's', v: order.users.company_name || order.shipping_name }
    
    // 합계금액 (공급가액 + 세액)
    const totalSupplyAmount = groupedItems.reduce((sum, item) => sum + item.supplyAmount, 0)
    const totalTaxAmount = groupedItems.reduce((sum, item) => sum + item.taxAmount, 0)
    const finalTotalAmount = totalSupplyAmount + totalTaxAmount + actualShippingFee
    
    const totalAmountKorean = numberToKorean(finalTotalAmount)
    const totalAmountFormatted = finalTotalAmount.toLocaleString()
    worksheet['D9'] = {
      t: 's',
      v: totalAmountKorean,
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet['I9'] = {
      t: 's',
      v: `₩${totalAmountFormatted}`,
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    
    // 상품 정보 입력 (12행부터 21행까지)
    for (let i = 0; i < 10; i++) {
      const row = 12 + i
      
      if (i < groupedItems.length) {
        const item = groupedItems[i]
        
        // 품명 (C열)
        worksheet[`C${row}`] = { 
          t: 's', 
          v: item.productName,
          s: {
            alignment: { horizontal: 'left' }
          }
        }
        
        // 규격/색상 (D열)
        worksheet[`D${row}`] = {
          t: 's',
          v: item.color,
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 수량 (E열)
        worksheet[`E${row}`] = {
          t: 'n',
          v: item.totalQuantity,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 단가 (F열)
        worksheet[`F${row}`] = {
          t: 'n',
          v: item.unitPrice,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 공급가액 (G열)
        worksheet[`G${row}`] = {
          t: 'n',
          v: item.supplyAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 세액 (H열)
        worksheet[`H${row}`] = {
          t: 'n',
          v: item.taxAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 비고 (I열)
        worksheet[`I${row}`] = { t: 's', v: '' }
      } else {
        // 빈 행 처리
        worksheet[`C${row}`] = { t: 's', v: '' }
        worksheet[`D${row}`] = { t: 's', v: '' }
        worksheet[`E${row}`] = { t: 's', v: '' }
        worksheet[`F${row}`] = { t: 's', v: '' }
        worksheet[`G${row}`] = { t: 's', v: '' }
        worksheet[`H${row}`] = { t: 's', v: '' }
        worksheet[`I${row}`] = { t: 's', v: '' }
      }
    }
    
    // 합계 행 (22행)
    const summaryRow = 22
    worksheet[`B${summaryRow}`] = {
      t: 's',
      v: '합    계',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet[`G${summaryRow}`] = {
      t: 'n',
      v: totalSupplyAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet[`H${summaryRow}`] = {
      t: 'n',
      v: totalTaxAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }

    // 열 너비 조정
    if (!worksheet['!cols']) {
      worksheet['!cols'] = []
    }
    worksheet['!cols'][0] = { width: 7.1 }   // A열
    worksheet['!cols'][1] = { width: 5 }     // B열
    worksheet['!cols'][2] = { width: 25 }    // C열
    worksheet['!cols'][3] = { width: 15 }    // D열
    worksheet['!cols'][4] = { width: 8 }     // E열
    worksheet['!cols'][5] = { width: 12 }    // F열
    worksheet['!cols'][6] = { width: 12 }    // G열
    worksheet['!cols'][7] = { width: 12 }    // H열
    worksheet['!cols'][8] = { width: 15 }    // I열

    // 엑셀 파일 생성
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    
  } catch (error) {
    console.error('Receipt generation error:', error)
    throw error
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