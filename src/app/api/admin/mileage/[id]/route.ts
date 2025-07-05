import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // 관리자 인증 확인 (생략 - 일반적으로 미들웨어에서 처리)
    // const { data: { user } } = await supabase.auth.getUser()
    // if (!user) {
    //   return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    // }

    const { type, amount, description } = await request.json()

    if (!type || !amount || !description) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다' }, { status: 400 })
    }

    const mileageId = params.id

    // 마일리지 수정 (수동 입력한 것만 수정 가능)
    const { data: mileageData, error: fetchError } = await supabase
      .from('mileage')
      .select('*')
      .eq('id', mileageId)
      .eq('source', 'manual')
      .single()

    if (fetchError || !mileageData) {
      return NextResponse.json({ error: '수정할 수 없는 마일리지입니다' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('mileage')
      .update({
        type,
        amount: type === 'earn' ? Math.abs(amount) : -Math.abs(amount),
        description,
        updated_at: new Date().toISOString()
      })
      .eq('id', mileageId)

    if (updateError) {
      console.error('마일리지 수정 오류:', updateError)
      return NextResponse.json({ error: '마일리지 수정에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('마일리지 수정 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // 관리자 인증 확인 (생략 - 일반적으로 미들웨어에서 처리)
    // const { data: { user } } = await supabase.auth.getUser()
    // if (!user) {
    //   return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    // }

    const mileageId = params.id

    // 마일리지 삭제 (수동 입력한 것만 삭제 가능)
    const { data: mileageData, error: fetchError } = await supabase
      .from('mileage')
      .select('*')
      .eq('id', mileageId)
      .eq('source', 'manual')
      .single()

    if (fetchError || !mileageData) {
      return NextResponse.json({ error: '삭제할 수 없는 마일리지입니다' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('mileage')
      .delete()
      .eq('id', mileageId)

    if (deleteError) {
      console.error('마일리지 삭제 오류:', deleteError)
      return NextResponse.json({ error: '마일리지 삭제에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('마일리지 삭제 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
} 