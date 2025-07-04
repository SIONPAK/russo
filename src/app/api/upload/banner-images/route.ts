import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'desktop' or 'mobile'
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: '파일이 선택되지 않았습니다.' 
      }, { status: 400 })
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: '파일 크기가 10MB를 초과합니다.' 
      }, { status: 400 })
    }

    // 파일 확장자 확인
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        error: '지원하지 않는 파일 형식입니다. (JPG, PNG, WEBP만 가능)' 
      }, { status: 400 })
    }

    // 파일명 생성 (timestamp + random)
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileExtension = file.name.split('.').pop()
    const fileName = `banner_${type}_${timestamp}_${randomStr}.${fileExtension}`

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('banners')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('파일 업로드 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '파일 업로드에 실패했습니다.' 
      }, { status: 500 })
    }

    // 공개 URL 생성
    const { data: publicUrlData } = supabase.storage
      .from('banners')
      .getPublicUrl(fileName)

    return NextResponse.json({ 
      success: true, 
      data: {
        fileName,
        publicUrl: publicUrlData.publicUrl
      },
      message: '파일이 업로드되었습니다.' 
    })
  } catch (error) {
    console.error('파일 업로드 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '파일 업로드에 실패했습니다.' 
    }, { status: 500 })
  }
}
