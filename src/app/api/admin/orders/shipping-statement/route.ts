import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
// 환경에 따라 다른 패키지 import
const isDev = process.env.NODE_ENV === 'development'
const puppeteer = isDev ? require('puppeteer') : require('puppeteer-core')
const chromium = isDev ? null : require('@sparticuz/chromium')
import path from 'path'
import fs from 'fs'
import { getKoreaTime, getKoreaDate, getKoreaDateFormatted } from '@/shared/lib/utils'
import { generateShippingStatement } from '@/shared/lib/shipping-statement-utils'
import JSZip from 'jszip'

// 숫자를 한글로 변환하는 함수
function convertToKoreanNumber(num: number): string {
  const units = ['', '만', '억', '조']
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십']
  const hundreds = ['', '일백', '이백', '삼백', '사백', '오백', '육백', '칠백', '팔백', '구백']
  const thousands = ['', '일천', '이천', '삼천', '사천', '오천', '육천', '칠천', '팔천', '구천']
  
  if (num === 0) return '영원'
  
  let result = ''
  let unitIndex = 0
  
  while (num > 0) {
    const remainder = num % 10000
    if (remainder > 0) {
      let part = ''
      
      const thousand = Math.floor(remainder / 1000)
      const hundred = Math.floor((remainder % 1000) / 100)
      const ten = Math.floor((remainder % 100) / 10)
      const one = remainder % 10
      
      if (thousand > 0) part += thousands[thousand]
      if (hundred > 0) part += hundreds[hundred]
      if (ten > 0) part += tens[ten]
      if (one > 0) part += digits[one]
      
      result = part + units[unitIndex] + result
    }
    
    num = Math.floor(num / 10000)
    unitIndex++
  }
  
  return result + '원'
}

// 최종 명세서 다운로드 API (엑셀 또는 PDF)
export async function POST(request: NextRequest) {
  try {
    const { orderIds, format = 'excel' } = await request.json()
    
    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }
    
    // Supabase 클라이언트 생성
    const supabase = await createClient()
    
    // 주문 정보 및 관련 데이터 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(
          id,
          company_name,
          representative_name,
          business_number,
          phone,
          address,
          email
        ),
        order_items!inner(
          id,
          product_id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          color,
          size,
          products!inner(
            id,
            name,
            code
          )
        )
      `)
      .in('id', orderIds)
      .order('created_at', { ascending: false })
    
    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({ error: '주문 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }
    
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }
    
    // 포맷에 따라 다른 파일 생성
    if (format === 'pdf') {
      try {
        const pdfBuffer = await generateMultipleStatementsPDF(orders)
        
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="shipping-statements-${getKoreaDateFormatted()}.pdf"`
          }
        })
      } catch (pdfError) {
        console.error('PDF 생성 실패, Excel로 폴백:', pdfError)
        
        // PDF 생성 실패 시 자동으로 Excel 다운로드
        const zipBuffer = await generateMultipleStatementsExcel(orders)
        
        return new NextResponse(zipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="receipts_bulk_download_${getKoreaDateFormatted()}.zip"`,
            'X-PDF-Fallback': 'true',
            'X-Fallback-Reason': 'PDF generation failed, automatically switched to Excel'
          }
        })
      }
    } else {
      // ZIP 파일로 개별 영수증 제공
      const zipBuffer = await generateMultipleStatementsExcel(orders)
      
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="receipts_bulk_download_${getKoreaDateFormatted()}.zip"`
        }
      })
    }
    
  } catch (error) {
    console.error('다운로드 오류:', error)
    return NextResponse.json({ error: '다운로드 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 개별 주문 다운로드 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const format = searchParams.get('format') || 'excel'
    
    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }
    
    // Supabase 클라이언트 생성
    const supabase = await createClient()
    
    // 주문 정보 및 관련 데이터 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(
          id,
          company_name,
          representative_name,
          business_number,
          phone,
          address,
          email
        ),
        order_items!inner(
          id,
          product_id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          color,
          size,
          products!inner(
            id,
            name,
            code
          )
        )
      `)
      .eq('id', orderId)
      .single()
    
    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({ error: '주문 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }
    
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }
    
    // 포맷에 따라 다른 파일 생성
    if (format === 'pdf') {
      try {
        const pdfBuffer = await generateMultipleStatementsPDF([order])
        
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="shipping-statement-${order.order_number}.pdf"`
          }
        })
      } catch (pdfError) {
        console.error('개별 PDF 생성 실패, Excel로 폴백:', pdfError)
        
        // PDF 생성 실패 시 Excel로 폴백
        const shippedItems = order.order_items.filter((item: any) => item.shipped_quantity > 0)
        
        const shippingStatementData = {
          orderNumber: order.order_number,
          companyName: order.users.company_name,
          businessLicenseNumber: order.users.business_number,
          email: order.users.email,
          phone: order.users.phone,
          address: order.users.address || '',
          postalCode: order.users.postal_code || '',
          customerGrade: order.users.customer_grade || 'general',
          shippedAt: order.shipped_at || new Date().toISOString(),
          items: shippedItems.map((item: any) => ({
            productName: item.products?.name || item.product_name,
            color: item.color || '기본',
            size: item.size || '',
            quantity: item.shipped_quantity,
            unitPrice: item.unit_price,
            totalPrice: item.unit_price * item.shipped_quantity
          })),
          totalAmount: shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0)
        }
        
        const excelBuffer = await generateShippingStatement(shippingStatementData)
        
        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="receipt_${order.order_number}.xlsx"`,
            'X-PDF-Fallback': 'true',
            'X-Fallback-Reason': 'PDF generation failed, automatically switched to Excel'
          }
        })
      }
    } else {
      // 개별 영수증 생성 (단일 엑셀 파일)
      const shippedItems = order.order_items.filter((item: any) => item.shipped_quantity > 0)
      
      const shippingStatementData = {
        orderNumber: order.order_number,
        companyName: order.users.company_name,
        businessLicenseNumber: order.users.business_number,
        email: order.users.email,
        phone: order.users.phone,
        address: order.users.address || '',
        postalCode: order.users.postal_code || '',
        customerGrade: order.users.customer_grade || 'general',
        shippedAt: order.shipped_at || new Date().toISOString(),
        items: shippedItems.map((item: any) => ({
          productName: item.products?.name || item.product_name,
          color: item.color || '기본',
          size: item.size || '',
          quantity: item.shipped_quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * item.shipped_quantity
        })),
        totalAmount: shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0)
      }
      
      const excelBuffer = await generateShippingStatement(shippingStatementData)
      
      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="receipt_${order.order_number}.xlsx"`
        }
      })
    }
    
  } catch (error) {
    console.error('다운로드 오류:', error)
    return NextResponse.json({ error: '다운로드 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 기존 Excel 생성 함수
async function generateMultipleStatementsExcel(orders: any[]): Promise<Buffer> {
  const zip = new JSZip()
  
  for (let index = 0; index < orders.length; index++) {
    const order = orders[index]
    const customer = order.users
    const orderItems = order.order_items
    
    const shippedItems = orderItems.filter((item: any) => item.shipped_quantity > 0)
    
    // 영수증 생성 (개별 다운로드와 완전히 동일한 방식)
    
    const shippingStatementData = {
      orderNumber: order.order_number,
      companyName: customer.company_name,
      businessLicenseNumber: customer.business_number,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
      postalCode: customer.postal_code || '',
      customerGrade: customer.customer_grade || 'general',
      shippedAt: order.shipped_at || new Date().toISOString(),
      items: shippedItems.map((item: any) => ({
        productName: item.products?.name || item.product_name,
        color: item.color || '기본',
        size: item.size || '',
        quantity: item.shipped_quantity,
        unitPrice: item.unit_price,
        totalPrice: item.unit_price * item.shipped_quantity
      })),
      totalAmount: shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0)
    }
    
    // 영수증 엑셀 생성 (개별 다운로드와 동일한 함수 사용)
    const receiptBuffer = await generateShippingStatement(shippingStatementData)
    
    // ZIP 파일에 개별 영수증 추가
    const fileName = `Receipt_${order.order_number}.xlsx`
    zip.file(fileName, receiptBuffer)
  }
  
  // ZIP 파일 생성
  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
  return Buffer.from(zipBuffer)
}

// PDF 생성 함수
// 환경에 따라 다른 Puppeteer 설정
async function getPuppeteerConfig() {
  const isDev = process.env.NODE_ENV === 'development'
  
  if (isDev) {
    console.log('🔧 개발 환경: 로컬 Chrome 사용')
    return {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      timeout: 120000,
      protocolTimeout: 120000
    }
  } else {
    console.log('🏭 프로덕션 환경: @sparticuz/chromium 사용')
    try {
      const executablePath = await chromium.executablePath()
      console.log('✅ Chromium 실행 파일 경로:', executablePath)
      
      return {
        args: [
          ...chromium.args,
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        executablePath,
        headless: true,
        timeout: 60000,
        protocolTimeout: 60000
      }
    } catch (error) {
      console.error('❌ Chromium 설정 실패:', error)
      throw new Error(`Chromium 설정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }
}

async function generateMultipleStatementsPDF(orders: any[]): Promise<Buffer> {
  let browser
  try {
    console.log('🚀 PDF 생성 시작 - 주문 수:', orders.length)
    
    // Puppeteer 설정 가져오기
    let puppeteerConfig
    try {
      puppeteerConfig = await getPuppeteerConfig()
      console.log('🔍 Puppeteer 설정 완료')
    } catch (configError) {
      console.error('❌ Puppeteer 설정 실패:', configError)
      throw configError
    }
    
    // 브라우저 시작 시도
    let retries = 3
    while (retries > 0) {
      try {
        browser = await puppeteer.launch(puppeteerConfig)
        console.log('✅ 브라우저 시작 완료')
        break
      } catch (launchError) {
        retries--
        console.error(`❌ 브라우저 시작 실패 (${3 - retries}/3 시도):`, launchError)
        
        if (retries === 0) {
          throw launchError
        }
        
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  
  if (!browser) {
    throw new Error('브라우저 시작에 실패했습니다.')
  }
  
  const page = await browser.newPage()
  
  // Vercel 환경에서 최적화된 페이지 설정
  await page.setViewport({ width: 1240, height: 1754 }) // A4 크기
  await page.setDefaultTimeout(30000) // 30초 타임아웃
  
  // 메모리 사용량 최적화
  await page.setRequestInterception(true)
  page.on('request', (req: any) => {
    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
      req.abort()
    } else {
      req.continue()
    }
  })
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: 'Apple SD Gothic Neo', Arial, sans-serif;
          font-size: 11px;
          line-height: 1.2;
          margin: 0;
          padding: 0;
        }
        .page-break {
          page-break-before: always;
        }
        
        /* 영수증 테이블 스타일 */
        table.receipt {
          border-collapse: collapse;
          width: 100%;
          margin: 20px 0;
        }
        
        /* 각 셀 스타일 */
        .receipt td {
          border: 1px solid #9a9a9a;
          padding: 2px;
          vertical-align: bottom;
        }
        
        /* 제목 셀 */
        .title-cell {
          width: 100%;
          height: 29px;
          background-color: #ffffff;
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          padding: 5px;
        }
        
        /* 기본 셀 크기들 */
        .col1 { width: 38px; }
        .col2 { width: 25px; }
        .col3 { width: 145px; }
        .col4 { width: 85px; }
        .col5 { width: 43px; }
        .col6 { width: 67px; }
        
        /* 행 높이 */
        .row-11 { height: 11px; }
        .row-10 { height: 10px; }
        .row-24 { height: 24px; }
        
        /* 텍스트 정렬 */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        /* 폰트 스타일 */
        .font-bold { font-weight: bold; }
        .font-11 { font-size: 11px; }
        .font-20 { font-size: 20px; }
        
        /* 특별 스타일 */
        .company-info {
          font-size: 11px;
        }
        .amount-text {
          font-size: 11px;
          font-weight: bold;
          text-align: center;
        }
        .total-row {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        /* 빈 셀 최소 높이 */
        .empty-cell {
          min-height: 14px;
        }
      </style>
    </head>
    <body>
  `
  
  orders.forEach((order: any, orderIndex: number) => {
    const customer = order.users
    const orderItems = order.order_items
    
    const shippedItems = orderItems.filter((item: any) => item.shipped_quantity > 0)
    
    const originalTotal = orderItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0)
    const shippedTotal = shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0)
    const shippingFee = order.shipping_fee || 0
    const finalTotal = shippedTotal + shippingFee
    
    const statementData = {
      statementNumber: `ST-${order.order_number}`,
      orderNumber: order.order_number,
      issueDate: getKoreaDateFormatted(),
      customer: {
        companyName: customer.company_name,
        representativeName: customer.representative_name,
        businessNumber: customer.business_number,
        phone: customer.phone,
        address: customer.address || '',
        email: customer.email
      },
      shipping: {
        recipientName: order.shipping_name || '',
        phone: order.shipping_phone || '',
        address: order.shipping_address || '',
        postalCode: order.shipping_postal_code || '',
        notes: order.notes || ''
      },
      amounts: {
        originalTotal,
        shippedTotal,
        shippingFee,
        finalTotal
      },
      shippingStatus: {
        totalItems: orderItems.length,
        shippedItems: shippedItems.length,
        completionRate: Math.round((shippedItems.length / orderItems.length) * 100)
      }
    }
    
    if (orderIndex > 0) {
      htmlContent += '<div class="page-break"></div>'
    }
    
    htmlContent += `
      <table cellspacing="0" cellpadding="0" class="receipt">
        <tbody>
          <tr>
            <td colspan="9" class="title-cell">
              <span class="font-bold">영수증</span><span>(공급받는자)</span>
            </td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 empty-cell"></td>
            <td class="col3 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
            <td class="col5 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10">날 짜 :</td>
            <td class="col3 row-10">${statementData.issueDate}</td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td colspan="4" rowspan="2" class="row-24 company-info">
              상호 : 주식회사 루소
            </td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10">수 신 :</td>
            <td class="col3 row-10">${statementData.customer.companyName}</td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10">참 조 :</td>
            <td class="col3 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td colspan="4" rowspan="2" class="row-24 company-info">
              전화번호 : 010-2131-7540
            </td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 empty-cell"></td>
            <td class="col3 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10">아래와 같이 영수 드립니다</td>
            <td class="col3 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 empty-cell"></td>
            <td class="col3 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
            <td class="col5 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td colspan="2" class="row-11">합계금액</td>
            <td colspan="4" rowspan="2" class="row-24 amount-text">
              ${convertToKoreanNumber(statementData.amounts.finalTotal)}
            </td>
            <td colspan="2" rowspan="2" class="row-24 text-center">
              ${statementData.amounts.finalTotal.toLocaleString()}
            </td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td colspan="2" class="row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 text-center">No.</td>
            <td class="col3 row-11 text-center">품명</td>
            <td class="col4 row-11 text-center">규격</td>
            <td class="col5 row-11 text-center">수량</td>
            <td class="col6 row-11 text-center">단가</td>
            <td class="col6 row-11 text-center">공급가액</td>
            <td class="col6 row-11 text-center">세액</td>
            <td class="col4 row-11 text-center">비고</td>
          </tr>
    `
    
    // 출고 상품 목록 (최대 10개까지)
    for (let idx = 0; idx < 10; idx++) {
      const item = shippedItems[idx]
      if (item) {
        const supplyAmount = Math.floor(item.unit_price * item.shipped_quantity / 1.1)
        const taxAmount = (item.unit_price * item.shipped_quantity) - supplyAmount
        
        htmlContent += `
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 text-center">${idx + 1}</td>
            <td class="col3 row-10">${item.products?.name || item.product_name}</td>
            <td class="col4 row-10 text-center">${item.color || ''}</td>
            <td class="col5 row-10 text-center">${item.shipped_quantity}</td>
            <td class="col6 row-10 text-center">${item.unit_price.toLocaleString()}</td>
            <td class="col6 row-10 text-center">${supplyAmount.toLocaleString()}</td>
            <td class="col6 row-10 text-center">${taxAmount.toLocaleString()}</td>
            <td class="col4 row-10 empty-cell"></td>
          </tr>
        `
      } else {
        htmlContent += `
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 text-center">${idx + 1}</td>
            <td class="col3 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
          </tr>
        `
      }
    }
    
    const totalSupplyAmount = Math.floor(statementData.amounts.shippedTotal / 1.1)
    const totalTaxAmount = statementData.amounts.shippedTotal - totalSupplyAmount
    
    htmlContent += `
          <tr class="total-row">
            <td class="col1 row-11 empty-cell"></td>
            <td colspan="5" class="row-11 text-center font-bold">합    계</td>
            <td class="col6 row-11 text-center font-bold">${totalSupplyAmount.toLocaleString()}</td>
            <td class="col6 row-11 text-center font-bold">${totalTaxAmount.toLocaleString()}</td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 empty-cell"></td>
            <td class="col3 row-11">국민은행 573701-04-214209 주식회사 루소</td>
            <td class="col4 row-11 empty-cell"></td>
            <td class="col5 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 empty-cell"></td>
            <td class="col3 row-10">부가세 포함 입금, 계산서는 자동발행입니다.</td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col6 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 empty-cell"></td>
            <td class="col3 row-11">감사합니다</td>
            <td class="col4 row-11 empty-cell"></td>
            <td class="col5 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col6 row-11 empty-cell"></td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
        </tbody>
      </table>
    `
  })
  
  htmlContent += `
    </body>
    </html>
  `
  
  await page.setContent(htmlContent)
  
  console.log('📄 PDF 생성 중...')
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm'
    }
  })
  
  console.log('✅ PDF 생성 완료')
  return Buffer.from(pdfBuffer)
  
  } catch (error) {
    console.error('❌ PDF 생성 실패:', error)
    
    // 에러 타입별 상세 로깅
    if (error instanceof Error) {
      console.error('에러 이름:', error.name)
      console.error('에러 메시지:', error.message)
      console.error('에러 스택:', error.stack)
      
      if (error.message.includes('Protocol error')) {
        console.error('🔍 Chrome 프로세스 관련 오류 - Vercel 환경에서 Chrome 프로세스가 올바르게 시작되지 않았습니다.')
      } else if (error.message.includes('spawn')) {
        console.error('🔍 실행 파일 관련 오류 - @sparticuz/chromium 패키지가 올바르게 설치되었는지 확인하세요.')
      } else if (error.message.includes('timeout')) {
        console.error('🔍 타임아웃 오류 - Vercel 함수 실행 시간이 초과되었습니다.')
      } else if (error.message.includes('executablePath')) {
        console.error('🔍 Chromium 경로 오류 - Vercel 환경에서 Chromium을 찾을 수 없습니다.')
      } else if (error.message.includes('brotli')) {
        console.error('🔍 Brotli 파일 오류 - @sparticuz/chromium의 압축 파일을 찾을 수 없습니다.')
        console.error('   해결 방법: 패키지를 재설치하거나 다른 버전을 시도하세요.')
      } else if (error.message.includes('input directory')) {
        console.error('🔍 디렉터리 오류 - Chromium 바이너리 파일이 올바르게 설치되지 않았습니다.')
        console.error('   해결 방법: yarn add @sparticuz/chromium@126.0.0 로 재설치하세요.')
      }
    }
    
    throw new Error(`PDF 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  } finally {
    if (browser) {
      try {
        await browser.close()
        console.log('🔒 브라우저 종료 완료')
      } catch (closeError) {
        console.error('브라우저 종료 중 오류:', closeError)
      }
    }
  }
}