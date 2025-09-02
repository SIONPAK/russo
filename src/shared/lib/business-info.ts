// 국세청 사업자등록정보 API 관련 함수들

// 환경변수에서 API 키 가져오기
const getApiKey = () => {
  return process.env.NEXT_PUBLIC_PUBLIC_DATA_API_KEY || ''
}

// 사업자등록번호 상태조회 (간단한 조회)
export const getBusinessStatus = async (businessNumber: string) => {
  const API_KEY = getApiKey()
  
  if (!API_KEY) {
    console.error('API 키가 설정되지 않았습니다.')
    return null
  }

  try {
    const response = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          b_no: [businessNumber.replace(/-/g, '')] // 하이픈 제거
        })
      }
    )

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    console.log('사업자등록정보 조회 결과:', data)

    if (data.status_code === 'OK' && data.data && data.data.length > 0) {
      const business = data.data[0]
      return {
        businessNumber: business.b_no,
        businessStatus: business.b_stt_cd,        // 업태코드
        businessStatusName: business.b_stt_cd_nm, // 업태명
        taxType: business.tax_type_cd,           // 과세유형코드
        taxTypeName: business.tax_type_cd_nm,    // 과세유형명
        isValid: business.b_stt === '01',        // 계속사업자 여부
        endDate: business.end_dt,                // 폐업일자
        utccYn: business.utcc_yn                 // 통신판매업 여부
      }
    }

    return null
  } catch (error) {
    console.error('사업자등록정보 조회 실패:', error)
    return null
  }
}

// 사업자등록정보 진위확인 (상세 정보)
export const validateBusinessInfo = async (businessData: {
  businessNumber: string
  representativeName: string
  openDate: string
  companyName?: string
  businessType?: string
  businessCategory?: string
  address?: string
}) => {
  const API_KEY = getApiKey()
  
  if (!API_KEY) {
    console.error('API 키가 설정되지 않았습니다.')
    return null
  }

  try {
    const requestBody = {
      b_no: businessData.businessNumber.replace(/-/g, ''),
      p_nm: businessData.representativeName,
      start_dt: businessData.openDate.replace(/-/g, ''),
      ...(businessData.companyName && { company: businessData.companyName }),
      ...(businessData.businessType && { b_type: businessData.businessType }),
      ...(businessData.businessCategory && { b_sector: businessData.businessCategory }),
      ...(businessData.address && { b_adr: businessData.address })
    }

    const response = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    console.log('사업자등록정보 진위확인 결과:', data)

    if (data.status_code === 'OK' && data.data && data.data.length > 0) {
      const business = data.data[0]
      return {
        isValid: business.valid === '01',        // 유효성
        businessNumber: business.b_no,
        businessStatus: business.b_stt_cd,
        businessStatusName: business.b_stt_cd_nm,
        taxType: business.tax_type_cd,
        taxTypeName: business.tax_type_cd_nm,
        message: business.valid_msg || '확인 완료'
      }
    }

    return null
  } catch (error) {
    console.error('사업자등록정보 진위확인 실패:', error)
    return null
  }
}

// 테스트용 함수
export const testBusinessApi = async () => {
  console.log('🔍 사업자등록정보 API 테스트 시작')
  
  // 테스트용 사업자등록번호 (실제 존재하는 번호로 테스트 필요)
  const testBusinessNumber = '1234567890'
  
  console.log('📋 상태조회 테스트:', testBusinessNumber)
  const statusResult = await getBusinessStatus(testBusinessNumber)
  console.log('✅ 상태조회 결과:', statusResult)
  
  return statusResult
} 