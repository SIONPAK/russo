'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ArrowLeft, Home, Search, Building2, User, Phone, Mail, Lock, FileText, Shield, Check, X } from 'lucide-react'
import { showSuccess, showError, showWarning, showInfo } from '@/shared/lib/toast'
import { formatPhoneNumber } from '@/shared/lib/utils'

interface RegisterFormData {
  // 약관 동의
  agreeTerms: boolean
  agreePrivacy: boolean
  agreeMarketing: boolean
  
  // 기본 정보
  userId: string
  email: string
  password: string
  passwordConfirm: string
  phone: string
  
  // 사업자 정보
  businessNumber: string
  companyName: string
  representativeName: string
  businessType: string
  businessCategory: string
  
  // 사업장 주소 정보
  postalCode: string
  address: string
  detailAddress: string
  
  // 배송지 정보
  recipientName: string
  recipientPhone: string
  recipientPostalCode: string
  recipientAddress: string
  recipientDetailAddress: string
}

declare global {
  interface Window {
    daum: any
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors }
  } = useForm<RegisterFormData>({
    mode: 'onChange'
  })

  const watchPassword = watch('password')
  const watchUserId = watch('userId')

  // 아이디 중복 확인
  const checkUserIdAvailability = async () => {
    const userId = getValues('userId')
    if (!userId || userId.length < 4) {
      showWarning('아이디는 4자 이상 입력해주세요.')
      return
    }

    // 아이디 형식 검증
    const userIdPattern = /^[a-zA-Z0-9]+$/
    if (!userIdPattern.test(userId)) {
      showWarning('아이디는 영문과 숫자만 사용 가능합니다.')
      return
    }

    setUsernameCheckStatus('checking')
    
    try {
      // 실제 API 호출
      const response = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: userId }),
      })

      const result = await response.json()

      if (result.success) {
        setUsernameCheckStatus('available')
        showSuccess(result.message)
      } else {
        setUsernameCheckStatus('taken')
        showError(result.message)
      }
    } catch (error) {
      setUsernameCheckStatus('idle')
      showError('중복 확인 중 오류가 발생했습니다.')
    }
  }

  // 우편번호 검색
  const handlePostcodeSearch = (type: 'business' | 'recipient') => {
    if (typeof window !== 'undefined' && window.daum) {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          const fullAddress = data.address
          const postalCode = data.zonecode
          
          if (type === 'business') {
            setValue('postalCode', postalCode)
            setValue('address', fullAddress)
          } else {
            setValue('recipientPostalCode', postalCode)
            setValue('recipientAddress', fullAddress)
          }
        }
      }).open()
    }
  }

  // 사업자등록번호 검증 (테스트용으로 간소화)
  const validateBusinessNumber = (value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '')
    if (cleanValue.length !== 10) return '사업자등록번호는 10자리여야 합니다'
    
    // 테스트용으로 길이만 체크
    return true
  }

  const onSubmit = async (data: RegisterFormData) => {
    if (usernameCheckStatus !== 'available') {
      showWarning('아이디 중복확인을 완료해주세요.')
      return
    }

    setIsLoading(true)
    
    try {
      // API 호출을 위한 데이터 변환
      const registerData = {
        username: data.userId,
        email: data.email,
        password: data.password,
        companyName: data.companyName,
        businessNumber: data.businessNumber,
        representativeName: data.representativeName,
        phone: data.phone,
        address: `${data.address} ${data.detailAddress}`.trim(),
        postalCode: data.postalCode,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        recipientAddress: `${data.recipientAddress} ${data.recipientDetailAddress}`.trim(),
        recipientPostalCode: data.recipientPostalCode,
        businessLicense: '', // 추후 파일 업로드 기능 추가
        businessType: data.businessType,        // 업태 추가
        businessCategory: data.businessCategory // 업종 추가
      }

      // 실제 회원가입 API 호출
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message)
        router.push('/auth/login')
      } else {
        showError(result.message)
      }
    } catch (error) {
      console.error('회원가입 실패:', error)
      showError('회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    // 1단계에서 2단계로 넘어갈 때: 약관 동의 확인
    if (currentStep === 1) {
      const agreeTerms = getValues('agreeTerms')
      const agreePrivacy = getValues('agreePrivacy')
      
      if (!agreeTerms || !agreePrivacy) {
        showWarning('필수 약관에 동의해주세요.')
        return
      }
    }
    
    // 2단계에서 3단계로 넘어갈 때: 모든 필수 필드 확인
    if (currentStep === 2) {
      const requiredFields = {
        userId: '아이디',
        email: '이메일',
        password: '비밀번호',
        passwordConfirm: '비밀번호 확인',
        phone: '전화번호',
        businessNumber: '사업자등록번호',
        companyName: '상호명',
        representativeName: '대표자명',
        businessType: '업태',
        businessCategory: '종목',
        postalCode: '우편번호',
        address: '주소'
      }
      
      // 아이디 중복확인 체크
      if (usernameCheckStatus !== 'available') {
        showWarning('아이디 중복확인을 완료해주세요.')
        return
      }
      
      // 비밀번호 일치 확인
      const password = getValues('password')
      const passwordConfirm = getValues('passwordConfirm')
      if (password !== passwordConfirm) {
        showError('비밀번호가 일치하지 않습니다.')
        return
      }
      
      // 필수 필드 확인
      for (const [field, label] of Object.entries(requiredFields)) {
        const value = getValues(field as keyof RegisterFormData)
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          showWarning(`${label}을(를) 입력해주세요.`)
          return
        }
      }
      
      // 사업자등록번호 유효성 검사
      const businessNumber = getValues('businessNumber')
      const businessNumberValidation = validateBusinessNumber(businessNumber)
      if (businessNumberValidation !== true) {
        showError(businessNumberValidation)
        return
      }
      
      // 이메일 형식 검사
      const email = getValues('email')
      const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
      if (!emailPattern.test(email)) {
        showError('올바른 이메일 형식을 입력해주세요.')
        return
      }
      
      // 전화번호 형식 검사
      const phone = getValues('phone')
      const phonePattern = /^(01[0-9]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0[3-9][0-9]-\d{3}-\d{4})$/
      if (!phonePattern.test(phone)) {
        showError('올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678, 02-123-4567, 031-123-4567)')
        return
      }
      
      // 비밀번호 강도 검사
      const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      if (password.length < 8 || !passwordPattern.test(password)) {
        showError('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.')
        return
      }
    }
    
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  // 아이디 변경 시 중복확인 상태 초기화
  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameCheckStatus('idle')
    // react-hook-form의 onChange도 호출
    setValue('userId', e.target.value)
  }

  // 사업자등록번호 포맷팅 (하이픈 자동 추가)
  const handleBusinessNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // 숫자만 추출
    const numbersOnly = value.replace(/[^0-9]/g, '')
    // 최대 10자리까지만 허용
    const limitedNumbers = numbersOnly.slice(0, 10)
    
    // 하이픈 추가 (3-2-5 형태)
    let formattedValue = limitedNumbers
    if (limitedNumbers.length > 3) {
      formattedValue = limitedNumbers.slice(0, 3) + '-' + limitedNumbers.slice(3)
    }
    if (limitedNumbers.length > 5) {
      formattedValue = limitedNumbers.slice(0, 3) + '-' + limitedNumbers.slice(3, 5) + '-' + limitedNumbers.slice(5)
    }
    
    setValue('businessNumber', formattedValue)
  }

  // 휴대폰 번호 포맷팅 (하이픈 자동 추가)
  const handlePhoneNumberChange = (fieldName: 'phone' | 'recipientPhone') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value)
    setValue(fieldName, formattedValue)
  }

  return (
    <>
      {/* 다음 우편번호 서비스 스크립트 */}
      <script 
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        async
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <div className="bg-white shadow-sm">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => router.back()} className="p-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold">회원가입</h1>
            <button onClick={() => router.push('/')} className="p-2">
              <Home className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6">
          {/* 진행 단계 */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep 
                    ? 'bg-black text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-1 mx-2 ${
                    step < currentStep ? 'bg-black' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 1단계: 약관 동의 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">약관 동의</h2>
                  <p className="text-sm text-gray-600">서비스 이용을 위해 약관에 동의해주세요</p>
                </div>

                {/* 약관 동의 */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">서비스 약관</h3>
                    
                    <label className="flex items-start space-x-3 mb-4">
                      <input
                        {...register('agreeTerms', {
                          required: '이용약관에 동의해주세요'
                        })}
                        type="checkbox"
                        className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">
                          <span className="text-red-500 font-medium">[필수]</span> 이용약관 동의
                        </span>
                        <Link href="#" className="text-xs text-blue-600 ml-2 underline">
                          내용보기
                        </Link>
                        <div className="text-xs text-gray-500 mt-1">
                          서비스 이용에 관한 기본 약관입니다.
                        </div>
                      </div>
                    </label>
                    {errors.agreeTerms && (
                      <p className="text-red-500 text-sm mb-4">{errors.agreeTerms.message}</p>
                    )}

                    <label className="flex items-start space-x-3 mb-4">
                      <input
                        {...register('agreePrivacy', {
                          required: '개인정보처리방침에 동의해주세요'
                        })}
                        type="checkbox"
                        className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">
                          <span className="text-red-500 font-medium">[필수]</span> 개인정보처리방침 동의
                        </span>
                        <Link href="#" className="text-xs text-blue-600 ml-2 underline">
                          내용보기
                        </Link>
                        <div className="text-xs text-gray-500 mt-1">
                          개인정보 수집 및 이용에 관한 동의입니다.
                        </div>
                      </div>
                    </label>
                    {errors.agreePrivacy && (
                      <p className="text-red-500 text-sm mb-4">{errors.agreePrivacy.message}</p>
                    )}

                    <label className="flex items-start space-x-3">
                      <input
                        {...register('agreeMarketing')}
                        type="checkbox"
                        className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">
                          <span className="text-gray-400 font-medium">[선택]</span> 마케팅 정보 수신 동의
                        </span>
                        <Link href="#" className="text-xs text-blue-600 ml-2 underline">
                          내용보기
                        </Link>
                        <div className="text-xs text-gray-500 mt-1">
                          할인 혜택, 이벤트 등 마케팅 정보를 받아보실 수 있습니다.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={nextStep}
                  className="w-full h-12 bg-black text-white font-medium rounded-xl hover:bg-gray-800"
                >
                  다음 단계
                </Button>
              </div>
            )}

            {/* 2단계: 기본 정보 + 사업자 정보 + 사업장 주소 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">기본 정보</h2>
                  <p className="text-sm text-gray-600">계정 및 사업자 정보를 입력해주세요</p>
                </div>

                <div className="space-y-6">
                  {/* 계정 정보 */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">계정 정보</h3>
                    <div className="space-y-4">
                      {/* 아이디 */}
                      <div>
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="아이디 (4자 이상, 영문/숫자)"
                              {...register('userId', {
                                required: '아이디를 입력해주세요',
                                minLength: {
                                  value: 4,
                                  message: '아이디는 4자 이상이어야 합니다'
                                },
                                pattern: {
                                  value: /^[a-zA-Z0-9]+$/,
                                  message: '아이디는 영문과 숫자만 사용 가능합니다'
                                }
                              })}
                              onChange={handleUserIdChange}
                              className="w-full h-12 text-base pl-10 pr-20"
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                              {usernameCheckStatus === 'available' && (
                                <Check className="w-5 h-5 text-green-500" />
                              )}
                              {usernameCheckStatus === 'taken' && (
                                <X className="w-5 h-5 text-red-500" />
                              )}
                              <Button
                                type="button"
                                onClick={checkUserIdAvailability}
                                disabled={!watchUserId || watchUserId.length < 4 || usernameCheckStatus === 'checking' || !/^[a-zA-Z0-9]+$/.test(watchUserId || '')}
                                className="text-xs px-2 py-1 h-8"
                              >
                                {usernameCheckStatus === 'checking' ? '확인중...' : '중복확인'}
                              </Button>
                            </div>
                          </div>
                        </div>
                        {errors.userId && (
                          <p className="text-red-500 text-sm mt-1">{errors.userId.message}</p>
                        )}
                        {usernameCheckStatus === 'available' && (
                          <p className="text-green-500 text-sm mt-1">사용 가능한 아이디입니다.</p>
                        )}
                        {usernameCheckStatus === 'taken' && (
                          <p className="text-red-500 text-sm mt-1">이미 사용 중인 아이디입니다.</p>
                        )}
                      </div>

                      {/* 이메일 */}
                      <div>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('email', {
                              required: '이메일을 입력해주세요',
                              pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: '올바른 이메일 형식이 아닙니다'
                              }
                            })}
                            type="email"
                            placeholder="이메일 주소를 입력하세요"
                            className="pl-10 h-12"
                          />
                        </div>
                        {errors.email && (
                          <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                        )}
                      </div>

                      {/* 비밀번호 */}
                      <div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('password', {
                              required: '비밀번호를 입력해주세요',
                              minLength: {
                                value: 8,
                                message: '비밀번호는 8자 이상이어야 합니다'
                              },
                              pattern: {
                                value: /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                                message: '영문, 숫자, 특수문자를 포함해야 합니다'
                              }
                            })}
                            type="password"
                            placeholder="비밀번호 (8자 이상, 영문+숫자+특수문자)"
                            className="pl-10 h-12"
                          />
                        </div>
                        {errors.password && (
                          <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                        )}
                      </div>

                      {/* 비밀번호 확인 */}
                      <div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('passwordConfirm', {
                              required: '비밀번호를 다시 입력해주세요',
                              validate: value => value === watchPassword || '비밀번호가 일치하지 않습니다'
                            })}
                            type="password"
                            placeholder="비밀번호 확인"
                            className="pl-10 h-12"
                          />
                        </div>
                        {errors.passwordConfirm && (
                          <p className="text-red-500 text-sm mt-1">{errors.passwordConfirm.message}</p>
                        )}
                      </div>

                      {/* 전화번호 */}
                      <div>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('phone', {
                              required: '전화번호를 입력해주세요',
                              pattern: {
                                value: /^(01[0-9]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0[3-9][0-9]-\d{3}-\d{4})$/,
                                message: '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678, 02-123-4567, 031-123-4567)'
                              },
                              onChange: handlePhoneNumberChange('phone')
                            })}
                            type="tel"
                            placeholder="전화번호 (숫자만 입력하시면 자동으로 하이픈이 추가됩니다)"
                            className="pl-10 h-12"
                            maxLength={13}
                          />
                        </div>
                        {errors.phone && (
                          <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 사업자 정보 */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">사업자 정보</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('businessNumber', {
                              required: '사업자등록번호를 입력해주세요',
                              validate: validateBusinessNumber,
                              onChange: handleBusinessNumberChange
                            })}
                            type="text"
                            placeholder="사업자등록번호 (10자리 숫자만 입력)"
                            className="pl-10 h-12"
                            maxLength={12}
                          />
                        </div>
                        {errors.businessNumber && (
                          <p className="text-red-500 text-sm mt-1">{errors.businessNumber.message}</p>
                        )}
                      </div>

                      <div>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('companyName', {
                              required: '상호명을 입력해주세요'
                            })}
                            type="text"
                            placeholder="상호명을 입력하세요"
                            className="pl-10 h-12"
                          />
                        </div>
                        {errors.companyName && (
                          <p className="text-red-500 text-sm mt-1">{errors.companyName.message}</p>
                        )}
                      </div>

                      <div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            {...register('representativeName', {
                              required: '대표자명을 입력해주세요'
                            })}
                            type="text"
                            placeholder="대표자명을 입력하세요"
                            className="pl-10 h-12"
                          />
                        </div>
                        {errors.representativeName && (
                          <p className="text-red-500 text-sm mt-1">{errors.representativeName.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Input
                            {...register('businessType', {
                              required: '업태를 입력해주세요'
                            })}
                            type="text"
                            placeholder="업태 (예: 도매업)"
                            className="h-12"
                          />
                          {errors.businessType && (
                            <p className="text-red-500 text-xs mt-1">{errors.businessType.message}</p>
                          )}
                        </div>
                        <div>
                          <Input
                            {...register('businessCategory', {
                              required: '종목을 입력해주세요'
                            })}
                            type="text"
                            placeholder="종목 (예: 의류)"
                            className="h-12"
                          />
                          {errors.businessCategory && (
                            <p className="text-red-500 text-xs mt-1">{errors.businessCategory.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 사업장 주소 */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">사업장 주소</h3>
                    <div className="space-y-3">
                      <div className="flex space-x-2">
                        <Input
                          {...register('postalCode', {
                            required: '우편번호를 입력해주세요'
                          })}
                          type="text"
                          placeholder="우편번호"
                          className="flex-1 h-11"
                          readOnly
                        />
                        <Button
                          type="button"
                          onClick={() => handlePostcodeSearch('business')}
                          className="px-4 h-11 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                      {errors.postalCode && (
                        <p className="text-red-500 text-sm">{errors.postalCode.message}</p>
                      )}
                      
                      <Input
                        {...register('address', {
                          required: '주소를 입력해주세요'
                        })}
                        type="text"
                        placeholder="주소"
                        className="h-11"
                        readOnly
                      />
                      {errors.address && (
                        <p className="text-red-500 text-sm">{errors.address.message}</p>
                      )}
                      
                      <Input
                        {...register('detailAddress')}
                        type="text"
                        placeholder="상세주소를 입력하세요"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="outline"
                    className="flex-1 h-12 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                  >
                    이전
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 h-12 bg-black text-white font-medium rounded-xl hover:bg-gray-800"
                  >
                    다음 단계
                  </Button>
                </div>
              </div>
            )}

            {/* 3단계: 배송지 정보 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">배송지 정보</h2>
                  <p className="text-sm text-gray-600">상품을 받을 배송지 정보를 입력해주세요</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">배송지 정보</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...register('recipientName', {
                              required: '수령인명을 입력해주세요'
                            })}
                            type="text"
                            placeholder="수령인명"
                            className="pl-9 h-11"
                          />
                        </div>
                        {errors.recipientName && (
                          <p className="text-red-500 text-xs mt-1">{errors.recipientName.message}</p>
                        )}
                      </div>
                      <div>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            {...register('recipientPhone', {
                              required: '연락처를 입력해주세요',
                              pattern: {
                                value: /^(01[0-9]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0[3-9][0-9]-\d{3}-\d{4})$/,
                                message: '올바른 전화번호 형식이 아닙니다'
                              },
                              onChange: handlePhoneNumberChange('recipientPhone')
                            })}
                            type="tel"
                            placeholder="전화번호 (숫자만 입력)"
                            className="pl-9 h-11"
                            maxLength={13}
                          />
                        </div>
                        {errors.recipientPhone && (
                          <p className="text-red-500 text-xs mt-1">{errors.recipientPhone.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Input
                        {...register('recipientPostalCode', {
                          required: '우편번호를 입력해주세요'
                        })}
                        type="text"
                        placeholder="우편번호"
                        className="flex-1 h-11"
                        readOnly
                      />
                      <Button
                        type="button"
                        onClick={() => handlePostcodeSearch('recipient')}
                        className="px-4 h-11 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                    {errors.recipientPostalCode && (
                      <p className="text-red-500 text-sm">{errors.recipientPostalCode.message}</p>
                    )}
                    
                    <Input
                      {...register('recipientAddress', {
                        required: '주소를 입력해주세요'
                      })}
                      type="text"
                      placeholder="주소"
                      className="h-11"
                      readOnly
                    />
                    {errors.recipientAddress && (
                      <p className="text-red-500 text-sm">{errors.recipientAddress.message}</p>
                    )}
                    
                    <Input
                      {...register('recipientDetailAddress')}
                      type="text"
                      placeholder="상세주소를 입력하세요"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="outline"
                    className="flex-1 h-12 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                  >
                    이전
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 h-12 bg-black text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-70"
                  >
                    {isLoading ? '가입 중...' : '회원가입 완료'}
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* 하단 링크 */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link href="/auth/login" className="text-black font-medium hover:underline">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
} 