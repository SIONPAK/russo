import { NextRequest, NextResponse } from 'next/server'

// 사업자번호 검증 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessNumber } = body

    if (!businessNumber) {
      return NextResponse.json({
        success: false,
        error: '사업자등록번호가 필요합니다.'
      }, { status: 400 })
    }

    // 사업자번호 형식 검증
    const cleaned = businessNumber.replace(/[^0-9]/g, '')
    if (cleaned.length !== 10) {
      return NextResponse.json({
        success: false,
        error: '사업자등록번호는 10자리 숫자여야 합니다.'
      }, { status: 400 })
    }

    // 체크섬 검증
    const checksum = validateBusinessNumberChecksum(cleaned)
    if (!checksum) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 사업자등록번호입니다.'
      }, { status: 400 })
    }

    // 국세청 API 호출 (실제 API 연동)
    const validationResult = await validateWithNTS(cleaned)
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || '사업자번호 검증에 실패했습니다.'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        businessNumber: cleaned,
        isValid: true,
        companyInfo: validationResult.companyInfo || null
      },
      message: '유효한 사업자등록번호입니다.'
    })

  } catch (error) {
    console.error('Business number validation error:', error)
    return NextResponse.json({
      success: false,
      error: '사업자번호 검증 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 사업자번호 체크섬 검증
function validateBusinessNumberChecksum(businessNumber: string): boolean {
  if (businessNumber.length !== 10) return false

  const digits = businessNumber.split('').map(Number)
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i]
  }
  
  // 9번째 자리수에 5를 곱한 후 10으로 나눈 나머지를 더함
  sum += Math.floor((digits[8] * 5) / 10)
  
  // 체크디지트 계산
  const checkDigit = (10 - (sum % 10)) % 10
  
  return checkDigit === digits[9]
}

// 국세청 API 연동 (실제 API 호출)
async function validateWithNTS(businessNumber: string) {
  try {
    // 국세청 사업자등록정보 진위확인 API
    const API_KEY = process.env.NTS_API_KEY // 환경변수에서 API 키 가져오기
    
    if (!API_KEY) {
      console.warn('NTS API KEY가 설정되지 않았습니다. 체크섬 검증만 수행합니다.')
      return {
        success: true,
        companyInfo: null
      }
    }

    const requestData = {
      b_no: [businessNumber] // 사업자번호 배열
    }

    const response = await fetch('https://api.odcloud.kr/api/nts-businessman/v1/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Infuser ${API_KEY}`
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      console.error('NTS API 호출 실패:', response.status, response.statusText)
      // API 호출 실패 시 체크섬 검증만으로 통과
      return {
        success: true,
        companyInfo: null
      }
    }

    const result = await response.json()
    
    if (!result.data || result.data.length === 0) {
      return {
        success: false,
        error: '사업자번호 정보를 찾을 수 없습니다.'
      }
    }

    const businessInfo = result.data[0]
    
    // 사업자 상태 확인
    if (businessInfo.b_stt_cd !== '01') {
      const statusMessages: { [key: string]: string } = {
        '02': '휴업자',
        '03': '폐업자',
        '04': '비실무자',
        '05': '일시정지',
        '06': '신규등록',
        '07': '말소'
      }
      
      return {
        success: false,
        error: `사업자 상태: ${statusMessages[businessInfo.b_stt_cd] || '알 수 없음'}`
      }
    }

    // 세금계산서 발급가능 여부 확인
    const taxInvoiceStatus = businessInfo.tax_type_cd === '01' ? '일반과세자' : 
                           businessInfo.tax_type_cd === '02' ? '간이과세자' : 
                           businessInfo.tax_type_cd === '03' ? '면세사업자' : '알 수 없음'

    return {
      success: true,
      companyInfo: {
        businessNumber: businessInfo.b_no,
        companyName: businessInfo.company || null,
        representativeName: businessInfo.p_nm || null,
        businessStatus: businessInfo.b_stt || '계속사업자',
        businessType: businessInfo.b_type || null,
        taxType: taxInvoiceStatus,
        isValidForTaxInvoice: businessInfo.tax_type_cd === '01' || businessInfo.tax_type_cd === '02'
      }
    }

  } catch (error) {
    console.error('NTS API 호출 오류:', error)
    // API 오류 시 체크섬 검증만으로 통과
    return {
      success: true,
      companyInfo: null
    }
  }
}

// GET - 사업자번호 검증 (쿼리 파라미터 방식)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessNumber = searchParams.get('businessNumber')

    if (!businessNumber) {
      return NextResponse.json({
        success: false,
        error: '사업자등록번호가 필요합니다.'
      }, { status: 400 })
    }

    // POST 메서드와 동일한 로직 수행
    const cleaned = businessNumber.replace(/[^0-9]/g, '')
    if (cleaned.length !== 10) {
      return NextResponse.json({
        success: false,
        error: '사업자등록번호는 10자리 숫자여야 합니다.'
      }, { status: 400 })
    }

    const checksum = validateBusinessNumberChecksum(cleaned)
    if (!checksum) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 사업자등록번호입니다.'
      }, { status: 400 })
    }

    const validationResult = await validateWithNTS(cleaned)
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || '사업자번호 검증에 실패했습니다.'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        businessNumber: cleaned,
        isValid: true,
        companyInfo: validationResult.companyInfo || null
      },
      message: '유효한 사업자등록번호입니다.'
    })

  } catch (error) {
    console.error('Business number validation error:', error)
    return NextResponse.json({
      success: false,
      error: '사업자번호 검증 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 