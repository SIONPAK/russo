import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaDate } from '@/shared/lib/utils'

// GET - 사용자 세금계산서 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const yearMonth = searchParams.get('yearMonth') || getKoreaDate().slice(0, 7) // YYYY-MM
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 회사명 파라미터 확인
    const companyName = searchParams.get('companyName')
    if (!companyName) {
      return NextResponse.json({
        success: false,
        error: '회사명이 필요합니다.'
      }, { status: 400 })
    }

    // 회사 정보 조회
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select(`
        id,
        company_name,
        representative_name,
        business_number,
        address,
        phone,
        email
      `)
      .eq('company_name', companyName)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        success: false,
        error: '회사 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 월의 시작일과 종료일 계산
    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    console.log(`세금계산서 조회 기간: ${startDate} ~ ${endDate}`)

    // 해당 월의 마일리지 차감 내역 조회 (주문 결제로 차감된 것만)
    const { data: mileageData, error: mileageError } = await supabase
      .from('mileage')
      .select(`
        id,
        amount,
        description,
        created_at,
        order_id
      `)
      .eq('user_id', userData.id)
      .eq('type', 'spend')
      .eq('source', 'order')
      .gte('created_at', startDate + 'T00:00:00+09:00')
      .lte('created_at', endDate + 'T23:59:59+09:00')
      .order('created_at', { ascending: false })

    if (mileageError) {
      console.error('마일리지 차감 내역 조회 오류:', mileageError)
      return NextResponse.json({
        success: false,
        error: '마일리지 내역 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 총 차감 금액 계산
    const totalDeduction = mileageData?.reduce((sum, record) => sum + Math.abs(record.amount), 0) || 0

    // 공급가액 및 부가세 계산
    const supplyAmount = Math.round(totalDeduction / 1.1)
    const vatAmount = Math.round(supplyAmount * 0.1)
    const totalWithVat = supplyAmount + vatAmount

    // 세금계산서 발행 상태 조회
    const { data: taxInvoiceStatus, error: statusError } = await supabase
      .from('tax_invoice_status')
      .select('*')
      .eq('company_name', userData.company_name)
      .eq('year_month', yearMonth)
      .single()

    if (statusError && statusError.code !== 'PGRST116') {
      console.error('세금계산서 상태 조회 오류:', statusError)
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    const totalItems = mileageData?.length || 0
    const totalPages = Math.ceil(totalItems / limit)
    const paginatedMileageData = mileageData?.slice(offset, offset + limit) || []

    // 응답 데이터 구성
    const responseData = {
      yearMonth,
      period: {
        startDate,
        endDate
      },
      companyInfo: {
        companyName: userData.company_name,
        representativeName: userData.representative_name,
        businessNumber: userData.business_number,
        address: userData.address,
        phone: userData.phone,
        email: userData.email
      },
      taxInvoiceInfo: {
        totalDeduction,
        supplyAmount,
        vatAmount,
        totalWithVat,
        status: taxInvoiceStatus?.status || 'X', // O: 발행완료, △: 진행중, X: 미발행
        issuedAt: taxInvoiceStatus?.issued_at || null,
        issuedBy: taxInvoiceStatus?.issued_by || null
      },
      mileageDetails: paginatedMileageData.map(record => ({
        id: record.id,
        amount: Math.abs(record.amount),
        description: record.description,
        orderId: record.order_id,
        createdAt: record.created_at
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('세금계산서 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '세금계산서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 