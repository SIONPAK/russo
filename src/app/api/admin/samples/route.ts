import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 샘플 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    
    const offset = (page - 1) * limit
    const supabase = createClient()

    let query = supabase
      .from('samples')
      .select(`
        *,
        users!samples_customer_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone
        ),
        products!samples_product_id_fkey (
          id,
          name,
          price,
          stock_quantity
        )
      `, { count: 'exact' })

    // 검색 조건 적용
    if (search) {
      query = query.or(`sample_number.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: samples, error, count } = await query

    if (error) {
      console.error('Samples fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 샘플 데이터에 날짜 계산 추가 (회수완료 상태에서는 D-day 계산하지 않음)
    const samplesWithDays = samples?.map(sample => {
      let daysRemaining = null
      let daysPassed = null
      let isOverdue = false

      // 회수완료 상태가 아닐 때만 D-day 계산
      if (sample.outgoing_date && sample.status !== 'returned' && sample.status !== 'charged') {
        const outgoingDate = new Date(sample.outgoing_date)
        const now = new Date()
        const diffTime = now.getTime() - outgoingDate.getTime()
        daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        daysRemaining = 21 - daysPassed
        isOverdue = daysRemaining < 0 && sample.status === 'shipped'
      }

      return {
        ...sample,
        days_passed: daysPassed,
        days_remaining: daysRemaining,
        is_overdue: isOverdue,
        // 촬영용 샘플은 0원 표기
        display_amount: sample.sample_type === 'photography' ? 0 : sample.charge_amount
      }
    })

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: samplesWithDays || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })

  } catch (error) {
    console.error('Samples API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 샘플 출고 및 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    // 관리자 샘플 생성 처리
    if (body.action === 'create_sample') {
      const { customerId, customerName, items } = body

      if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({
          success: false,
          error: '필수 정보가 누락되었습니다.'
        }, { status: 400 })
      }

      const results = []

      for (const item of items) {
        const { productId, productCode, productName, color, size, quantity } = item

        if (!productId || !quantity || quantity <= 0) {
          results.push({
            productId,
            success: false,
            error: '상품 정보가 누락되었습니다.'
          })
          continue
        }

        try {
          // 상품 정보 확인
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, price, stock_quantity')
            .eq('id', productId)
            .single()

          if (productError || !product) {
            results.push({
              productId,
              success: false,
              error: '상품을 찾을 수 없습니다.'
            })
            continue
          }

          // 💡 샘플은 재고 연동하지 않음 (재고 확인 제거)
          // 샘플관리는 별도로 수동 관리

          // 고유한 샘플 번호 생성 (분할 방지를 위해 더 고유한 값 사용)
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const uniqueStr = (Date.now() + Math.random() * 1000).toString(36).toUpperCase().slice(-4)
          const sampleNumber = `SP-${dateStr}-${uniqueStr}`

          // 샘플 생성 (항상 0원)
          const { data: sample, error: sampleError } = await supabase
            .from('samples')
            .insert({
              sample_number: sampleNumber,
              customer_id: customerId,
              customer_name: customerName,
              product_id: productId,
              product_name: productName,
              product_options: `색상: ${color}, 사이즈: ${size}`,
              quantity,
              sample_type: 'photography',
              charge_amount: 0, // 샘플 주문은 항상 0원
              status: 'pending',
              created_at: getKoreaTime()
            })
            .select()
            .single()

          if (sampleError) {
            results.push({
              productId,
              success: false,
              error: '샘플 생성에 실패했습니다.'
            })
            continue
          }

          // 💡 샘플은 재고 연동하지 않음 (재고 차감 및 이력 기록 제거)
          // 샘플 출고/회수는 팀장님이 별도 수동 관리

          results.push({
            productId,
            customerId,
            customerName,
            success: true,
            sampleNumber,
            data: sample
          })

          // 짧은 지연으로 순차 처리 보장 및 분할 방지
          await new Promise(resolve => setTimeout(resolve, 50))

        } catch (error) {
          console.error(`샘플 생성 오류 (${productId}):`, error)
          results.push({
            productId,
            customerId,
            success: false,
            error: '처리 중 오류가 발생했습니다.'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const successResults = results.filter(r => r.success)
      
      console.log('✅ 샘플 일괄 생성 완료:', {
        총요청: items.length,
        성공: successCount,
        성공목록: successResults.map(r => ({ 업체: r.customerName, 샘플번호: r.sampleNumber }))
      })
      
      return NextResponse.json({
        success: successCount > 0,
        message: `${successCount}개의 샘플이 성공적으로 생성되었습니다.`,
        data: results
      })
    }

    // 기존 샘플 출고 로직
    const { 
      customer_id,
      product_id,
      product_options,
      quantity,
      notes,
      sample_type = 'photography', // 'photography' | 'sales'
      charge_amount
    } = body

    // 필수 필드 검증
    if (!customer_id || !product_id || !quantity) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 고객 정보 확인
    const { data: customer, error: customerError } = await supabase
      .from('users')
      .select('id, company_name, representative_name, mileage_balance')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 고객입니다.'
      }, { status: 400 })
    }

    // 상품 정보 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 상품입니다.'
      }, { status: 400 })
    }

    // 💡 샘플은 재고 연동하지 않음 (재고 확인 제거)
    // 샘플관리는 별도로 수동 관리

    // 고유한 샘플 번호 생성 (SP-YYYYMMDD-XXXX 형식)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const uniqueStr = (Date.now() + Math.random() * 1000).toString(36).toUpperCase().slice(-4)
    const sampleNumber = `SP-${dateStr}-${uniqueStr}`

    // 촬영용 샘플은 0원, 판매용 샘플은 실제 금액
    const finalChargeAmount = sample_type === 'photography' ? 0 : (charge_amount || product.price * quantity)

    // 샘플 출고 처리
    const { data: sample, error: sampleError } = await supabase
      .from('samples')
      .insert({
        sample_number: sampleNumber,
        customer_id,
        customer_name: customer.company_name,
        product_id,
        product_name: product.name,
        product_options: product_options || '',
        quantity,
        outgoing_date: getKoreaTime(),
        status: 'pending',
        sample_type,
        charge_amount: finalChargeAmount,
        notes,
        due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21일 후
        created_at: getKoreaTime()
      })
      .select(`
        *,
        users!samples_customer_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone
        ),
        products!samples_product_id_fkey (
          id,
          name,
          price,
          stock_quantity
        )
      `)
      .single()

    if (sampleError) {
      console.error('Sample creation error:', sampleError)
      return NextResponse.json({
        success: false,
        error: '샘플 출고에 실패했습니다.'
      }, { status: 500 })
    }

    // 💡 샘플은 재고 연동하지 않음 (재고 차감 및 이력 기록 제거)
    // 샘플 출고/회수는 팀장님이 별도 수동 관리

    return NextResponse.json({
      success: true,
      data: sample,
      message: `${sample_type === 'photography' ? '촬영용' : '판매용'} 샘플이 성공적으로 출고되었습니다.`
    })

  } catch (error) {
    console.error('Sample creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// PUT - 샘플 상태 업데이트 (회수, 마일리지 차감 등)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    // 일괄 상태 업데이트
    if (body.action === 'bulk_status_update') {
      const { sampleIds, status, trackingData } = body

      if (!sampleIds || !Array.isArray(sampleIds) || sampleIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: '샘플 ID가 필요합니다.'
        }, { status: 400 })
      }

      const results = []

      for (const sampleId of sampleIds) {
        try {
          const updateData: any = {
            status,
            updated_at: getKoreaTime()
          }

          // 운송장 데이터가 있는 경우
          if (trackingData && Array.isArray(trackingData)) {
            const trackingInfo = trackingData.find(t => t.sampleId === sampleId)
            if (trackingInfo && trackingInfo.trackingNumber) {
              updateData.tracking_number = trackingInfo.trackingNumber
            }
          }

          // 배송 시작 시 출고일 설정
          if (status === 'shipped') {
            updateData.outgoing_date = getKoreaTime()
          }

          const { error: updateError } = await supabase
            .from('samples')
            .update(updateData)
            .eq('id', sampleId)

          if (updateError) {
            results.push({
              sampleId,
              success: false,
              error: updateError.message
            })
          } else {
            results.push({
              sampleId,
              success: true
            })
          }
        } catch (error) {
          results.push({
            sampleId,
            success: false,
            error: '처리 중 오류가 발생했습니다.'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      
      return NextResponse.json({
        success: true,
        message: `${successCount}개 샘플이 성공적으로 업데이트되었습니다.`,
        data: results
      })
    }

    // 단일 샘플 상태 변경
    if (body.sampleId && body.status) {
      console.log('Single sample status update request:', body)
      
      const { sampleId, status, trackingNumber, outgoingDate, adminNotes } = body

      // 현재 샘플 데이터 조회
      const { data: currentSample, error: fetchError } = await supabase
        .from('samples')
        .select('*')
        .eq('id', sampleId)
        .single()

      if (fetchError || !currentSample) {
        return NextResponse.json({
          success: false,
          error: '샘플을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      const updateData: any = {
        status,
        updated_at: getKoreaTime()
      }

      if (trackingNumber) {
        updateData.tracking_number = trackingNumber
      }

      if (outgoingDate) {
        updateData.outgoing_date = outgoingDate
      }

      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes
      }

      // 상태별 타임스탬프 자동 설정 (순차적으로 이전 단계들도 설정)
      const now = new Date().toISOString()
      
      switch (status) {
        case 'approved':
          updateData.approved_at = now
          break
          
        case 'preparing':
          if (!currentSample.approved_at) {
            updateData.approved_at = now
          }
          // preparing 상태는 별도 타임스탬프 없음 (approved_at 이후로 간주)
          break
          
        case 'shipped':
          if (!currentSample.approved_at) {
            updateData.approved_at = now
          }
          updateData.shipped_at = now
          if (!updateData.outgoing_date) {
            updateData.outgoing_date = now
          }
          break
          
        case 'delivered':
          if (!currentSample.approved_at) {
            updateData.approved_at = now
          }
          if (!currentSample.shipped_at) {
            updateData.shipped_at = now
          }
          updateData.delivered_at = now
          break
          
        case 'returned':
          if (!currentSample.approved_at) {
            updateData.approved_at = now
          }
          if (!currentSample.shipped_at) {
            updateData.shipped_at = now
          }
          if (!currentSample.delivered_at) {
            updateData.delivered_at = now
          }
          updateData.return_date = now
          
          // 색상/사이즈 정보 파싱
          const parseOptions = (options: string) => {
            const colorMatch = options.match(/색상:\s*([^,]+)/);
            const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
            return {
              color: colorMatch ? colorMatch[1].trim() : null,
              size: sizeMatch ? sizeMatch[1].trim() : null
            };
          };

          const { color: sampleColor, size: sampleSize } = parseOptions(currentSample.product_options || '');

          // 반납 시 재고 복구
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', currentSample.product_id)
            .single()

          if (!productError && productData) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: productData.stock_quantity + currentSample.quantity,
                updated_at: now
              })
              .eq('id', currentSample.product_id)
          }

          // 재고 복구 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: currentSample.product_id,
              movement_type: 'sample_return',
              quantity: currentSample.quantity,
              color: sampleColor,
              size: sampleSize,
              reason: `샘플 반납 (${currentSample.sample_number})`,
              reference_id: currentSample.id,
              reference_type: 'sample',
              created_at: now
            })
          break
          
        case 'rejected':
          updateData.rejected_at = now
          
          // 색상/사이즈 정보 파싱
          const parseOptionsReject = (options: string) => {
            const colorMatch = options.match(/색상:\s*([^,]+)/);
            const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
            return {
              color: colorMatch ? colorMatch[1].trim() : null,
              size: sizeMatch ? sizeMatch[1].trim() : null
            };
          };

          const { color: rejectColor, size: rejectSize } = parseOptionsReject(currentSample.product_options || '');
          
          // 거절 시 재고 복구
          const { data: rejectedProductData, error: rejectedProductError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', currentSample.product_id)
            .single()

          if (!rejectedProductError && rejectedProductData) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: rejectedProductData.stock_quantity + currentSample.quantity,
                updated_at: now
              })
              .eq('id', currentSample.product_id)

            // 재고 복구 이력 기록
            await supabase
              .from('stock_movements')
              .insert({
                product_id: currentSample.product_id,
                movement_type: 'sample_reject',
                quantity: currentSample.quantity,
                color: rejectColor,
                size: rejectSize,
                reason: `샘플 거절 (${currentSample.sample_number})`,
                reference_id: currentSample.id,
                reference_type: 'sample',
                created_at: now
              })
          }
          break
      }

      console.log('Update data:', updateData)
      console.log('Sample ID:', sampleId)

      const { data, error: updateError } = await supabase
        .from('samples')
        .update(updateData)
        .eq('id', sampleId)
        .select()

      console.log('Update result:', { data, error: updateError })

      if (updateError) {
        console.error('Sample status update error:', updateError)
        return NextResponse.json({
          success: false,
          error: `샘플 상태 업데이트에 실패했습니다: ${updateError.message}`
        }, { status: 500 })
      }

      if (!data || data.length === 0) {
        console.error('No sample found with ID:', sampleId)
        return NextResponse.json({
          success: false,
          error: '해당 샘플을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        message: '샘플 상태가 업데이트되었습니다.',
        data: data[0]
      })
    }

    // 기존 일괄 처리 로직
    const { 
      sampleIds,
      action // 'recover', 'charge_manual', 'charge_auto'
    } = body

    if (!sampleIds || !Array.isArray(sampleIds) || sampleIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '샘플 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 샘플 정보 조회
    const { data: samples, error: samplesError } = await supabase
      .from('samples')
      .select(`
        *,
        users!samples_customer_id_fkey (
          id,
          company_name,
          mileage_balance
        ),
        products!samples_product_id_fkey (
          id,
          name,
          price
        )
      `)
      .in('id', sampleIds)

    if (samplesError || !samples) {
      return NextResponse.json({
        success: false,
        error: '샘플 정보를 조회할 수 없습니다.'
      }, { status: 500 })
    }

    const results = []

    for (const sample of samples) {
      try {
        if (action === 'recover') {
          // 샘플 회수 처리
          const { error: updateError } = await supabase
            .from('samples')
            .update({
              status: 'recovered',
              return_date: getKoreaTime(),
              updated_at: getKoreaTime()
            })
            .eq('id', sample.id)

          if (!updateError) {
            // 색상/사이즈 정보 파싱
            const parseOptionsRecover = (options: string) => {
              const colorMatch = options.match(/색상:\s*([^,]+)/);
              const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
              return {
                color: colorMatch ? colorMatch[1].trim() : null,
                size: sizeMatch ? sizeMatch[1].trim() : null
              };
            };

            const { color: recoverColor, size: recoverSize } = parseOptionsRecover(sample.product_options || '');

            // 새로운 재고 관리 시스템으로 재고 복구
            const { data: restoreResult, error: restoreError } = await supabase
              .rpc('adjust_physical_stock', {
                p_product_id: sample.product_id,
                p_color: recoverColor,
                p_size: recoverSize,
                p_quantity_change: sample.quantity, // 양수로 복원
                p_reason: `샘플 회수 - ${sample.sample_number}`
              })

            if (restoreError || !restoreResult) {
              console.error('❌ 샘플 재고 복원 실패:', restoreError)
            } else {
              console.log('✅ 샘플 재고 복원 완료:', sample.sample_number)
            }

            // 재고 변동 이력 기록
            await supabase
              .from('stock_movements')
              .insert({
                product_id: sample.product_id,
                movement_type: 'sample_return',
                quantity: sample.quantity,
                color: recoverColor,
                size: recoverSize,
                reference_id: sample.id,
                reference_type: 'sample',
                notes: `샘플 회수: ${sample.sample_number}`,
                created_at: getKoreaTime()
              })

            results.push({
              sample_id: sample.id,
              action: 'recovered',
              success: true
            })
          }

        } else if (action === 'charge_auto') {
          // 21일 초과 시 자동 마일리지 차감
          const outgoingDate = new Date(sample.outgoing_date)
          const now = new Date()
          const diffDays = Math.ceil((now.getTime() - outgoingDate.getTime()) / (1000 * 60 * 60 * 24))

                      if (diffDays > 21) {
            const chargeAmount = sample.charge_amount || (sample.products.price * sample.quantity)
            const currentMileage = sample.users.mileage_balance || 0

            if (currentMileage >= chargeAmount) {
              // 마일리지 차감
              await supabase
                .from('users')
                .update({
                  mileage_balance: currentMileage - chargeAmount
                })
                .eq('id', sample.customer_id)

              // 마일리지 이력 기록
              await supabase
                .from('mileage_logs')
                .insert({
                  user_id: sample.customer_id,
                  type: 'deduction',
                  amount: -chargeAmount,
                  reason: 'sample_overdue',
                  reference_id: sample.id,
                  reference_type: 'sample',
                  description: `샘플 미반납 차감: ${sample.sample_number} (${diffDays}일 경과)`,
                  created_at: getKoreaTime()
                })

              // 샘플 상태 업데이트
              await supabase
                .from('samples')
                .update({
                  status: 'charged',
                  charge_date: getKoreaTime(),
                  updated_at: getKoreaTime()
                })
                .eq('id', sample.id)

              results.push({
                sample_id: sample.id,
                action: 'charged',
                success: true,
                charged_amount: chargeAmount,
                days_overdue: diffDays
              })
            } else {
              results.push({
                sample_id: sample.id,
                action: 'charge_failed',
                success: false,
                error: '마일리지 잔액 부족',
                required_amount: chargeAmount,
                current_mileage: currentMileage
              })
            }
          } else {
            results.push({
              sample_id: sample.id,
              action: 'not_overdue',
              success: false,
              error: '아직 21일이 지나지 않았습니다.',
              days_remaining: 21 - diffDays
            })
          }
        }

      } catch (error) {
        console.error(`Sample ${sample.id} processing error:`, error)
        results.push({
          sample_id: sample.id,
          action: action,
          success: false,
          error: '처리 중 오류가 발생했습니다.'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.filter(r => r.success).length}개 샘플이 처리되었습니다.`,
      data: results
    })

  } catch (error) {
    console.error('Sample update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 