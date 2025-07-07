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

    // 파일 개수 제한 (한 번에 최대 10개로 증가)
    if (files.length > 10) {
      return NextResponse.json({
        success: false,
        error: '한 번에 최대 10개의 파일만 업로드할 수 있습니다.'
      }, { status: 400 })
    }

    const uploadedUrls: string[] = []
    const errors: string[] = []

    // 순차적으로 파일 업로드 처리
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        console.log(`파일 ${i + 1}/${files.length} 업로드 중: ${file.name}`)
        
        // 파일 확장자 검증
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        if (!allowedTypes.includes(file.type)) {
          errors.push(`${file.name}: 지원하지 않는 파일 형식입니다.`)
          continue
        }

        // 파일 크기 검증 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          errors.push(`${file.name}: 파일 크기가 5MB를 초과합니다.`)
          continue
        }

        // 고유한 파일명 생성
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `products/${fileName}`

        // Supabase Storage에 업로드
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          console.error('Upload error:', error)
          errors.push(`${file.name}: 업로드 실패 - ${error.message}`)
          continue
        }

        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
        console.log(`파일 ${i + 1}/${files.length} 업로드 완료: ${file.name}`)
        
      } catch (uploadError) {
        console.error('Individual upload error:', uploadError)
        errors.push(`${file.name}: 업로드 중 오류 발생`)
      }
    }

    // 결과 반환
    if (uploadedUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: '모든 파일 업로드에 실패했습니다.',
        errors
      }, { status: 500 })
    }

    console.log(`업로드 완료: 성공 ${uploadedUrls.length}개, 실패 ${errors.length}개`)

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedUrls
      },
      message: `${uploadedUrls.length}개 파일 업로드 완료${errors.length > 0 ? `, ${errors.length}개 실패` : ''}`,
      errors: errors.length > 0 ? errors : undefined
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