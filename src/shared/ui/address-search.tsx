'use client'

import { useEffect, useRef } from 'react'
import { Button } from './button'

declare global {
  interface Window {
    daum: any
  }
}

interface AddressSearchProps {
  onAddressSelect: (data: {
    zonecode: string
    address: string
    detailAddress?: string
  }) => void
  className?: string
  buttonText?: string
}

export const AddressSearch = ({ 
  onAddressSelect, 
  className = '',
  buttonText = '주소 검색'
}: AddressSearchProps) => {
  const scriptLoaded = useRef(false)

  useEffect(() => {
    const loadKakaoScript = () => {
      if (window.daum || scriptLoaded.current) return

      const script = document.createElement('script')
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.async = true
      script.onload = () => {
        scriptLoaded.current = true
      }
      document.head.appendChild(script)
    }

    loadKakaoScript()
  }, [])

  const openAddressSearch = () => {
    if (!window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    new window.daum.Postcode({
      oncomplete: function(data: any) {
        // 사용자가 선택한 주소 정보를 처리
        let addr = '' // 주소 변수
        let extraAddr = '' // 참고항목 변수

        // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
        if (data.userSelectedType === 'R') { // 도로명 주소
          addr = data.roadAddress
        } else { // 지번 주소
          addr = data.jibunAddress
        }

        // 도로명 주소인 경우 참고항목을 조합한다.
        if (data.userSelectedType === 'R') {
          // 법정동명이 있을 경우 추가한다. (법정리는 제외)
          if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
            extraAddr += data.bname
          }
          // 건물명이 있고, 공동주택일 경우 추가한다.
          if (data.buildingName !== '' && data.apartment === 'Y') {
            extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName)
          }
          // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
          if (extraAddr !== '') {
            extraAddr = ' (' + extraAddr + ')'
          }
        }

        // 최종 주소 정보
        const fullAddress = addr + extraAddr

        onAddressSelect({
          zonecode: data.zonecode,
          address: fullAddress,
          detailAddress: ''
        })
      },
      theme: {
        bgColor: '#FFFFFF',
        searchBgColor: '#0B65C8',
        contentBgColor: '#FFFFFF',
        pageBgColor: '#FAFAFA',
        textColor: '#333333',
        queryTextColor: '#FFFFFF',
        postcodeTextColor: '#FA4256',
        emphTextColor: '#008BD3',
        outlineColor: '#E0E0E0'
      },
      width: '100%',
      height: '100%'
    }).open()
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={openAddressSearch}
      className={className}
    >
      {buttonText}
    </Button>
  )
} 