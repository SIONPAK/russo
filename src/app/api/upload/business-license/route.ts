import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { uploadBusinessLicense } from '@/shared/lib/storage'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 선택되지 않았습니다.' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 파일 업로드
    const uploadResult = await uploadBusinessLicense(file, userId)

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 400 }
      )
    }

    // 데이터베이스에 URL 업데이트
    const supabase = createClient()
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        business_license: uploadResult.url,
        updated_at: getKoreaTime()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { success: false, error: '데이터베이스 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        url: uploadResult.url,
        user: user
      },
      message: '사업자등록증이 성공적으로 업로드되었습니다.'
    })

  } catch (error) {
    console.error('Business license upload error:', error)
    return NextResponse.json(
      { success: false, error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 