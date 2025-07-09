import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
// 환경에 따라 다른 패키지 import
const isDev = process.env.NODE_ENV === 'development'
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
            'Content-Type': 'application/zip; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`receipts_bulk_download_${getKoreaDateFormatted()}.zip`)}`,
            'Content-Length': zipBuffer.length.toString(),
            'Cache-Control': 'no-cache',
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
          'Content-Type': 'application/zip; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`receipts_bulk_download_${getKoreaDateFormatted()}.zip`)}`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'no-cache'
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
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`receipt_${order.order_number}.xlsx`)}`,
            'Content-Length': excelBuffer.length.toString(),
            'Cache-Control': 'no-cache'
          }
        })
      }
    } else {
      // 개별 영수증 생성 (단일 엑셀 파일)
      const shippedItems = order.order_items.filter((item: any) => item.shipped_quantity > 0)
      
      // 프로덕션 환경에서 데이터 확인을 위한 로깅
      console.log('🔍 주문 데이터 확인:', {
        orderNumber: order.order_number,
        companyName: order.users.company_name,
        environment: process.env.NODE_ENV,
        shippedItemsCount: shippedItems.length,
        firstItem: shippedItems[0] ? {
          productName: shippedItems[0].products?.name || shippedItems[0].product_name,
          color: shippedItems[0].color
        } : null
      })
      
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
      
      console.log('🔍 Excel 전달 데이터:', {
        companyName: shippingStatementData.companyName,
        itemsCount: shippingStatementData.items.length,
        firstItemName: shippingStatementData.items[0]?.productName,
        firstItemColor: shippingStatementData.items[0]?.color
      })
      
      const excelBuffer = await generateShippingStatement(shippingStatementData)
      
              return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`receipt_${order.order_number}.xlsx`)}`,
            'Content-Length': excelBuffer.length.toString(),
            'Cache-Control': 'no-cache'
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

// 환경에 따라 다른 Puppeteer 설정 (Vercel 커뮤니티 해결책 적용)
async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development'
  // 실제 존재하는 v137.0.1 릴리즈 사용, 아키텍처별 파일명 적용
  const REMOTE_PATH = process.env.CHROMIUM_REMOTE_EXEC_PATH || 'https://github.com/Sparticuz/chromium/releases/download/v137.0.1/chromium-v137.0.1-pack.x64.tar'
  const LOCAL_PATH = process.env.CHROMIUM_LOCAL_EXEC_PATH
  
  if (isDev) {
    console.log('🔧 개발 환경: 로컬 Chrome 사용 시도')
    
    // 로컬 Chrome 경로들 시도
    const possiblePaths = [
      LOCAL_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser'
    ].filter(Boolean) as string[]
    
    for (const path of possiblePaths) {
      try {
        const fs = await import('fs')
        if (fs.existsSync(path)) {
          console.log(`✅ 로컬 Chrome 발견: ${path}`)
          const puppeteer = await import('puppeteer')
          return await puppeteer.default.launch({
            executablePath: path,
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu'
            ]
          })
        }
      } catch (error) {
        console.log(`⚠️ 경로 확인 실패: ${path}`)
        continue
      }
    }
    
    console.log('⚠️ 개발 환경에서 Chrome을 찾을 수 없습니다.')
    console.log('🔧 Chrome 설치 방법:')
    console.log('   - brew install --cask google-chrome')
    console.log('   - 또는 .env.local에 CHROMIUM_LOCAL_EXEC_PATH 설정')
    console.log('📋 현재는 Excel 다운로드로 대체됩니다.')
    
    throw new Error('개발 환경에서 Chrome을 찾을 수 없습니다. Excel 다운로드로 전환됩니다.')
  }
  
  // 프로덕션 환경: @sparticuz/chromium-min 사용
  console.log('🏭 프로덕션 환경: @sparticuz/chromium-min 사용')
  console.log('🔍 원격 Chromium 경로:', REMOTE_PATH)
  
  const chromium = await import('@sparticuz/chromium-min')
  const puppeteer = await import('puppeteer-core')
  
  const executablePath = await chromium.default.executablePath(REMOTE_PATH)
  
  return await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath,
    headless: true,
    timeout: 120000
  })
}

async function generateMultipleStatementsPDF(orders: any[]): Promise<Buffer> {
  let browser
  try {
    console.log('🚀 PDF 생성 시작 - 주문 수:', orders.length)
    
    // 브라우저 시작
    browser = await getBrowser()
    console.log('✅ 브라우저 시작 완료')
    
    const page = await browser.newPage()
    
    // 페이지 오류 핸들링
    page.on('pageerror', (err: Error) => {
      console.error('페이지 오류:', err)
    })
    page.on('error', (err: Error) => {
      console.error('페이지 런타임 오류:', err)
    })
    
    // Vercel 환경에서 최적화된 페이지 설정
    await page.setViewport({ width: 1240, height: 1754 }) // A4 크기
    await page.setDefaultTimeout(30000) // 30초 타임아웃
    
    // 메모리 사용량 최적화 (폰트는 허용)
    await page.setRequestInterception(true)
    page.on('request', (req: any) => {
      if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet') {
        req.abort()
      } else {
        req.continue()
      }
    })
    
    // 현재 환경에 맞는 폰트 경로 설정
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://russo-seven.vercel.app'
      : 'http://localhost:3000'
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @font-face {
            font-family: 'Pretendard';
            src: url('${baseUrl}/fonts/PretendardVariable.woff2') format('woff2');
            font-weight: 100 900;
            font-style: normal;
            font-display: swap;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* 로컬 폰트 우선 사용 */
          * {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          
          body {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
            font-size: 11px;
            line-height: 1.2;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            font-feature-settings: "liga" off;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          /* 영수증 테이블 스타일 */
          table.receipt {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          
          /* 각 셀 스타일 */
          .receipt td {
            border: 1px solid #9a9a9a;
            padding: 2px;
            vertical-align: bottom;
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
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
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
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
          .font-bold { 
            font-weight: bold; 
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          .font-11 { font-size: 11px; }
          .font-20 { font-size: 20px; }
          
          /* 특별 스타일 */
          .company-info {
            font-size: 11px;
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          .amount-text {
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          .total-row {
            background-color: #f5f5f5;
            font-weight: bold;
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
          }
          
          /* 빈 셀 최소 높이 */
          .empty-cell {
            min-height: 14px;
          }
          
          /* 한글 텍스트 강제 적용 */
          .korean-text {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
            font-weight: 400;
          }
          
          .korean-text-bold {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', '나눔고딕', Dotum, '돋움', Gulim, '굴림', sans-serif !important;
            font-weight: 700;
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
              <span class="korean-text-bold">영수증</span><span class="korean-text">(공급받는자)</span>
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
            <td class="col2 row-10 korean-text">날 짜 :</td>
            <td class="col3 row-10 korean-text">${statementData.issueDate}</td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td colspan="4" rowspan="2" class="row-24 company-info korean-text">
              상호 : 주식회사 루소
            </td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 korean-text">수 신 :</td>
            <td class="col3 row-10 korean-text">${statementData.customer.companyName}</td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-10 empty-cell"></td>
            <td class="col2 row-10 korean-text">참 조 :</td>
            <td class="col3 row-10 empty-cell"></td>
            <td class="col4 row-10 empty-cell"></td>
            <td class="col5 row-10 empty-cell"></td>
            <td colspan="4" rowspan="2" class="row-24 company-info korean-text">
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
            <td class="col2 row-10 korean-text">아래와 같이 영수 드립니다</td>
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
            <td colspan="2" class="row-11 korean-text">합계금액</td>
            <td colspan="4" rowspan="2" class="row-24 amount-text korean-text">
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
            <td class="col3 row-11 text-center korean-text">품명</td>
            <td class="col4 row-11 text-center korean-text">규격</td>
            <td class="col5 row-11 text-center korean-text">수량</td>
            <td class="col6 row-11 text-center korean-text">단가</td>
            <td class="col6 row-11 text-center korean-text">공급가액</td>
            <td class="col6 row-11 text-center korean-text">세액</td>
            <td class="col4 row-11 text-center korean-text">비고</td>
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
            <td class="col3 row-10 korean-text">${item.products?.name || item.product_name}</td>
            <td class="col4 row-10 text-center korean-text">${item.color || ''}</td>
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
            <td colspan="5" class="row-11 text-center font-bold korean-text-bold">합    계</td>
            <td class="col6 row-11 text-center font-bold">${totalSupplyAmount.toLocaleString()}</td>
            <td class="col6 row-11 text-center font-bold">${totalTaxAmount.toLocaleString()}</td>
            <td class="col4 row-11 empty-cell"></td>
          </tr>
          
          <tr>
            <td class="col1 row-11 empty-cell"></td>
            <td class="col2 row-11 empty-cell"></td>
            <td class="col3 row-11 korean-text">국민은행 573701-04-214209 주식회사 루소</td>
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
            <td class="col3 row-10 korean-text">부가세 포함 입금, 계산서는 자동발행입니다.</td>
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
            <td class="col3 row-11 korean-text">감사합니다</td>
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
  
  console.log('📄 HTML 콘텐츠 로드 중...')
  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0',
    timeout: 30000
  })
  
  // 폰트 로딩 완료 대기 (5초 대기)
  console.log('⏳ 폰트 로딩 대기 중...')
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  console.log('📄 PDF 생성 중...')
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm'
    },
    preferCSSPageSize: true
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
      
      if (error.message.includes('개발 환경에서 Chrome을 찾을 수 없습니다.')) {
        console.error('🔧 개발 환경에서 로컬 Chrome을 찾을 수 없습니다.')
        console.error('   → Excel 다운로드로 자동 전환됩니다.')
      } else if (error.message.includes('Protocol error')) {
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