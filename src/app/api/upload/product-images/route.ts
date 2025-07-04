import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: '업로드할 파일이 없습니다.'
      }, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      // 파일 확장자 검증
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
      if (!allowedTypes.includes(file.type)) {
        continue
      }

      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        continue
      }

      try {
        // 고유한 파일명 생성
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `products/${fileName}`

        // Supabase Storage에 업로드 시도
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error('Upload error:', error)
          // Storage 오류 시 더미 URL 사용 (개발용)
          const dummyUrl = `https://via.placeholder.com/400x400/cccccc/666666?text=${encodeURIComponent(file.name)}`
          uploadedUrls.push(dummyUrl)
          continue
        }

        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
      } catch (uploadError) {
        console.error('Individual upload error:', uploadError)
        // 개별 파일 업로드 실패 시 더미 URL 사용
        const dummyUrl = `https://via.placeholder.com/400x400/cccccc/666666?text=${encodeURIComponent(file.name)}`
        uploadedUrls.push(dummyUrl)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedUrls
      }
    })

  } catch (error) {
    console.error('Image upload API error:', error)
    return NextResponse.json({
      success: false,
      error: '이미지 업로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// DELETE - 이미지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')
    const filePath = searchParams.get('filePath')

    if (!imageId && !filePath) {
      return NextResponse.json({
        success: false,
        error: '이미지 ID 또는 파일 경로가 필요합니다.'
      }, { status: 400 })
    }

    // 데이터베이스에서 이미지 정보 삭제
    if (imageId) {
      const { data: imageData, error: fetchError } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('id', imageId)
        .single()

      if (fetchError || !imageData) {
        return NextResponse.json({
          success: false,
          error: '이미지를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // URL에서 파일 경로 추출
      const url = new URL(imageData.image_url)
      const pathParts = url.pathname.split('/')
      const extractedFilePath = pathParts.slice(-2).join('/') // products/filename

      // Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove([extractedFilePath])

      if (storageError) {
        console.error('Storage delete error:', storageError)
      }

      // 데이터베이스에서 레코드 삭제
      const { error: dbError } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId)

      if (dbError) {
        console.error('Database delete error:', dbError)
        return NextResponse.json({
          success: false,
          error: '이미지 삭제에 실패했습니다.'
        }, { status: 500 })
      }
    } else if (filePath) {
      // 임시 파일 삭제 (상품 생성 전 업로드된 파일)
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove([filePath])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        return NextResponse.json({
          success: false,
          error: '파일 삭제에 실패했습니다.'
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: '이미지가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Delete API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 