import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { trackingData } = body

    if (!trackingData || !Array.isArray(trackingData) || trackingData.length === 0) {
      return NextResponse.json({
        success: false,
        error: '운송장 데이터가 필요합니다.'
      }, { status: 400 })
    }

    const results = {
      total: trackingData.length,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }

    for (const data of trackingData) {
      try {
        const {
          receiverName,
          receiverPhone,
          receiverAddress,
          companyName,
          itemName,
          itemQuantity
        } = data

        if (!receiverName || !receiverPhone) {
          results.errors++
          results.errorDetails.push(`필수 정보 누락: 받는분 성명 또는 전화번호`)
          continue
        }

        // 받는분 정보로 샘플 조회
        let query = supabase
          .from('samples')
          .select(`
            id,
            customer_name,
            product_name,
            product_options,
            quantity,
            users!samples_customer_id_fkey (
              representative_name,
              phone,
              company_name
            )
          `)

        // 받는분 성명으로 먼저 검색 (고객 정보 또는 샘플 고객명)
        query = query.or(`customer_name.ilike.%${receiverName}%,users.representative_name.ilike.%${receiverName}%`)

        const { data: samples, error: sampleError } = await query

        if (sampleError || !samples || samples.length === 0) {
          results.errors++
          results.errorDetails.push(`샘플 조회 실패: ${receiverName} - 일치하는 샘플을 찾을 수 없습니다`)
          continue
        }

        // 전화번호로 추가 필터링
        const matchedSamples = samples.filter(sample => {
          const samplePhone = (sample.users as any)?.phone || ''
          return samplePhone.includes(receiverPhone.replace(/-/g, '')) || 
                 receiverPhone.replace(/-/g, '').includes(samplePhone.replace(/-/g, ''))
        })

        if (matchedSamples.length === 0) {
          results.errors++
          results.errorDetails.push(`전화번호 불일치: ${receiverName} (${receiverPhone})`)
          continue
        }

        // 상품 정보로 세부 매칭 (내품명이 있는 경우)
        let targetSample = matchedSamples[0]
        if (itemName && matchedSamples.length > 1) {
          const itemMatched = matchedSamples.find(sample => {
            const sampleItemName = sample.product_name || ''
            return sampleItemName.includes(itemName) || itemName.includes(sampleItemName)
          })
          if (itemMatched) {
            targetSample = itemMatched
          }
        }

        // 운송장 번호 업데이트
        const { error: updateError } = await supabase
          .from('samples')
          .update({
            tracking_number: data.trackingNumber,
            status: 'shipped',
            shipped_at: getKoreaTime(),
            updated_at: getKoreaTime()
          })
          .eq('id', targetSample.id)

        if (updateError) {
          results.errors++
          results.errorDetails.push(`업데이트 실패: ${receiverName} - ${updateError.message}`)
        } else {
          results.updated++
        }

      } catch (error) {
        results.errors++
        results.errorDetails.push(`처리 중 오류: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `${results.updated}건 업데이트 완료, ${results.errors}건 실패`
    })

  } catch (error) {
    console.error('Bulk tracking update error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 