import { useState, useEffect, useCallback } from 'react'
import { useUserStore, ShippingAddress } from '@/entities/user/model/user-store'
import { fetchUserProfile, fetchShippingAddresses } from '@/shared/api/user'
import { showError } from '@/shared/lib/toast'

export interface OrderFormData {
  orderInfo: {
    name: string
    phone: string
    email: string
  }
  shippingInfo: {
    name: string
    phone: string
    address: string
    postalCode: string
  }
  useSameAddress: boolean
  orderNotes: string
}

export const useOrderForm = (userId: string) => {
  const { 
    profile, 
    defaultShippingAddress, 
    shippingAddresses,
    setProfile, 
    setShippingAddresses 
  } = useUserStore()

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<OrderFormData>({
    orderInfo: {
      name: '',
      phone: '',
      email: ''
    },
    shippingInfo: {
      name: '',
      phone: '',
      address: '',
      postalCode: ''
    },
    useSameAddress: true,
    orderNotes: ''
  })

  // 유저 정보 및 배송지 정보 로드
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) return
      
      setIsLoading(true)
      try {
        // 유저 프로필 로드
        const userProfile = await fetchUserProfile(userId)
        if (userProfile) {
          setProfile(userProfile)
          
          // 주문자 정보 설정
          setFormData(prev => ({
            ...prev,
            orderInfo: {
              name: userProfile.representative_name,
              phone: userProfile.phone,
              email: userProfile.email
            }
          }))
        }

        // 배송지 목록 로드
        const addresses = await fetchShippingAddresses(userId)
        setShippingAddresses(addresses)

      } catch (error) {
        console.error('유저 정보 로드 실패:', error)
        showError('사용자 정보를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [userId, setProfile, setShippingAddresses])

  // 기본 배송지 정보로 폼 초기화 (프로필이 로드된 후 한 번만 실행)
  useEffect(() => {
    if (profile && formData.orderInfo.name === '') {
      // 처음 프로필이 로드될 때만 실행
      const shippingInfo = defaultShippingAddress ? {
        name: defaultShippingAddress.name,
        phone: defaultShippingAddress.phone,
        address: defaultShippingAddress.address,
        postalCode: defaultShippingAddress.postal_code
      } : {
        name: profile.recipient_name || profile.representative_name,
        phone: profile.recipient_phone || profile.phone,
        address: profile.address || '',
        postalCode: profile.postal_code || ''
      }

      setFormData(prev => ({
        ...prev,
        shippingInfo: shippingInfo
      }))
    }
  }, [profile, defaultShippingAddress])

  // 주문자 정보 업데이트
  const updateOrderInfo = useCallback((field: keyof OrderFormData['orderInfo'], value: string) => {
    setFormData(prev => ({
      ...prev,
      orderInfo: {
        ...prev.orderInfo,
        [field]: value
      }
    }))
  }, [])

  // 배송지 정보 업데이트
  const updateShippingInfo = useCallback((field: keyof OrderFormData['shippingInfo'], value: string) => {
    setFormData(prev => ({
      ...prev,
      shippingInfo: {
        ...prev.shippingInfo,
        [field]: value
      }
    }))
  }, [])

  // 배송지 정보 전체 업데이트
  const updateAllShippingInfo = useCallback((shippingInfo: OrderFormData['shippingInfo']) => {
    setFormData(prev => ({
      ...prev,
      shippingInfo: shippingInfo
    }))
  }, [])

  // 배송지 동일 설정 토글
  const toggleUseSameAddress = useCallback((useSame: boolean) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        useSameAddress: useSame
      }
      
      if (useSame) {
        // 현재 주문자 정보로 배송지 설정
        newFormData.shippingInfo = {
          name: prev.orderInfo.name || '',
          phone: prev.orderInfo.phone || '',
          address: defaultShippingAddress?.address || profile?.address || '',
          postalCode: defaultShippingAddress?.postal_code || profile?.postal_code || ''
        }
      }
      
      return newFormData
    })
  }, [defaultShippingAddress, profile])

  // 저장된 배송지 선택
  const selectShippingAddress = useCallback((address: ShippingAddress) => {
    setFormData(prev => ({
      ...prev,
      shippingInfo: {
        name: address.name,
        phone: address.phone,
        address: address.address,
        postalCode: address.postal_code
      },
      useSameAddress: false
    }))
  }, [])

  // 주문 메모 업데이트
  const updateOrderNotes = useCallback((notes: string) => {
    setFormData(prev => ({
      ...prev,
      orderNotes: notes
    }))
  }, [])

  // 폼 유효성 검사
  const validateForm = useCallback((): string | null => {
    if (!formData.orderInfo.name || !formData.orderInfo.phone) {
      return '주문자 정보를 모두 입력해주세요.'
    }

    if (!formData.shippingInfo.name || !formData.shippingInfo.phone || 
        !formData.shippingInfo.address || !formData.shippingInfo.postalCode) {
      return '배송지 정보를 모두 입력해주세요.'
    }

    return null
  }, [formData])

  return {
    formData,
    isLoading,
    profile,
    shippingAddresses,
    defaultShippingAddress,
    updateOrderInfo,
    updateShippingInfo,
    updateAllShippingInfo,
    toggleUseSameAddress,
    selectShippingAddress,
    updateOrderNotes,
    validateForm
  }
} 