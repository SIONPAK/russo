import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { 
  generateShippingStatement,
  generateReturnStatement, 
  generateDeductionStatement, 
  ShippingStatementData,
  ReturnStatementData, 
  DeductionStatementData 
} from '@/shared/lib/shipping-statement-utils'

// GET - 문서 다운로드
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 사용자 인증 확인 (선택사항)
    const { data: { user } } = await supabase.auth.getUser()
    
    // query parameter에서 company_name 확인 (인증이 없을 경우)
    const { searchParams } = new URL(request.url)
    let companyName = searchParams.get('company_name')
    
    // 인증된 사용자가 있으면 자동으로 회사명을 가져옴
    if (user && !companyName) {
      const { data: userInfo } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', user.id)
        .single()
      
      if (userInfo) {
        companyName = userInfo.company_name
      }
    }

    // ID에서 타입과 실제 ID 분리
    const [type, actualId] = id.includes('_') ? id.split('_') : ['shipping', id]
    
    console.log('Auth status:', { hasUser: !!user, companyName, type, actualId })
    
    let fileName = ''
    let excelBuffer: Buffer | null = null

    if (type === 'shipping') {
      // 출고명세서 (새로운 유틸리티 사용)
      const { data: order, error: orderError } = await supabase
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
            business_number,
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
        .eq('id', actualId)
        .single()

      if (orderError || !order) {
        return NextResponse.json({
          success: false,
          error: '출고명세서를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // 사용자 권한 확인
      const orderUser = Array.isArray(order.users) ? order.users[0] : order.users
      if (!orderUser) {
        return NextResponse.json({
          success: false,
          error: '주문 사용자 정보를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // 인증된 사용자가 있으면 user.id로 체크, 없으면 company_name으로 체크
      if (user) {
        if (orderUser.id !== user.id) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }
      } else if (companyName) {
        if (orderUser.company_name !== companyName) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }
      } else {
        return NextResponse.json({
          success: false,
          error: '인증 또는 회사명이 필요합니다.'
        }, { status: 401 })
      }

      // 실제 출고된 상품만 필터링 (shipped_quantity가 없으면 전체 수량으로 간주)
      const shippedItems = order.order_items.filter((item: any) => {
        const shippedQty = item.shipped_quantity || item.quantity || 0
        return shippedQty > 0
      })

      if (shippedItems.length === 0) {
        return NextResponse.json({
          success: false,
          error: '출고된 상품이 없습니다.'
        }, { status: 400 })
      }

      const statementData: ShippingStatementData = {
        orderNumber: order.order_number,
        companyName: orderUser.company_name,
        businessLicenseNumber: orderUser.business_number,
        email: orderUser.email,
        phone: orderUser.phone,
        address: orderUser.address || '',
        postalCode: '',
        customerGrade: orderUser.customer_grade || 'BRONZE',
        shippedAt: order.shipped_at || order.created_at,
        items: shippedItems.map((item: any) => {
          const actualQuantity = item.shipped_quantity || item.quantity || 0
          return {
            productName: item.product_name,
            color: item.color || '-',
            size: item.size || '-',
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

      excelBuffer = await generateShippingStatement(statementData)
      fileName = `출고명세서_${order.order_number}.xlsx`

    } else if (type === 'return') {
      // 반품명세서 (새로운 유틸리티 사용)
      const { data: returnStatement, error: returnError } = await supabase
        .from('return_statements')
        .select('*')
        .eq('id', actualId)
        .single()

      if (returnError || !returnStatement) {
        return NextResponse.json({
          success: false,
          error: '반품명세서를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      let userData: any = null

      // 인증된 사용자가 있으면 사용자 정보 조회
      if (user) {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('id', user.id)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '사용자 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo

        // 사용자 권한 확인 (company_name으로 확인)
        if (returnStatement.company_name !== userData.company_name) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }
      } else if (companyName) {
        // 인증이 없는 경우 company_name으로 권한 확인
        if (returnStatement.company_name !== companyName) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }

        // company_name으로 사용자 정보 조회
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('company_name', companyName)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo
      } else {
        // companyName이 있는지 최종 확인
        if (!companyName) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        // companyName으로 권한 확인
        if (returnStatement.company_name !== companyName) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }

        // companyName으로 사용자 정보 조회
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('company_name', companyName)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo
      }

      const statementData: ReturnStatementData = {
        statementNumber: returnStatement.statement_number,
        companyName: userData.company_name,
        businessLicenseNumber: userData.business_number,
        email: userData.email,
        phone: userData.phone,
        address: userData.address || '',
        postalCode: '',
        customerGrade: userData.customer_grade || 'BRONZE',
        returnDate: returnStatement.created_at,
        returnReason: returnStatement.return_reason,
        items: (returnStatement.items || []).map((item: any) => ({
          productName: item.product_name,
          color: item.color || '-',
          size: item.size || '-',
          quantity: item.return_quantity || item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * (item.return_quantity || item.quantity)
        })),
        totalAmount: returnStatement.refund_amount || returnStatement.total_amount
      }

      excelBuffer = await generateReturnStatement(statementData)
      fileName = `반품명세서_${returnStatement.statement_number}.xlsx`

    } else if (type === 'deduction') {
      // 차감명세서 (새로운 유틸리티 사용)
      const { data: deductionStatement, error: deductionError } = await supabase
        .from('deduction_statements')
        .select('*')
        .eq('id', actualId)
        .single()

      if (deductionError || !deductionStatement) {
        return NextResponse.json({
          success: false,
          error: '차감명세서를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      let userData: any = null

      // 인증된 사용자가 있으면 사용자 정보 조회
      if (user) {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('id', user.id)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '사용자 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo

        // 사용자 권한 확인 (company_name으로 확인)
        if (deductionStatement.company_name !== userData.company_name) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }
      } else if (companyName) {
        // 인증이 없는 경우 company_name으로 권한 확인
        if (deductionStatement.company_name !== companyName) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }

        // company_name으로 사용자 정보 조회
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('company_name', companyName)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo
      } else {
        // companyName이 있는지 최종 확인
        if (!companyName) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        // companyName으로 권한 확인
        if (deductionStatement.company_name !== companyName) {
          return NextResponse.json({
            success: false,
            error: '접근 권한이 없습니다.'
          }, { status: 403 })
        }

        // companyName으로 사용자 정보 조회
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select(`
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number,
            customer_grade
          `)
          .eq('company_name', companyName)
          .single()

        if (userError || !userInfo) {
          return NextResponse.json({
            success: false,
            error: '회사 정보를 찾을 수 없습니다.'
          }, { status: 404 })
        }

        userData = userInfo
      }

      const statementData: DeductionStatementData = {
        statementNumber: deductionStatement.statement_number,
        companyName: userData.company_name,
        businessLicenseNumber: userData.business_number,
        email: userData.email,
        phone: userData.phone,
        address: userData.address || '',
        postalCode: '',
        customerGrade: userData.customer_grade || 'BRONZE',
        deductionDate: deductionStatement.created_at,
        deductionReason: deductionStatement.deduction_reason,
        deductionType: deductionStatement.deduction_type,
        items: (deductionStatement.items || []).map((item: any) => ({
          productName: item.product_name,
          color: item.color || '-',
          size: item.size || '-',
          quantity: item.deduction_quantity || item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * (item.deduction_quantity || item.quantity)
        })),
        totalAmount: deductionStatement.total_amount
      }

      excelBuffer = await generateDeductionStatement(statementData)
      fileName = `차감명세서_${deductionStatement.statement_number}.xlsx`

    } else {
      return NextResponse.json({
        success: false,
        error: '잘못된 문서 타입입니다.'
      }, { status: 400 })
    }

    // 모든 명세서를 직접 다운로드로 처리
    if (excelBuffer) {
      // 파일명 인코딩 처리
      const encodedFileName = encodeURIComponent(fileName)
      
      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
          'Cache-Control': 'no-cache'
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: '명세서 생성에 실패했습니다.'
    }, { status: 500 })

  } catch (error) {
    console.error('명세서 다운로드 오류:', error)
    return NextResponse.json({
      success: false,
      error: '명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 