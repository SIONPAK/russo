import { createClient } from './supabase'
import { FILE_UPLOAD } from '@/shared/constants'

const supabase = createClient()

// 버킷 이름들
export const STORAGE_BUCKETS = {
  BUSINESS_LICENSES: 'business-licenses', // 사업자등록증
  PRODUCT_IMAGES: 'product-images',       // 상품 이미지
  USER_AVATARS: 'user-avatars',          // 사용자 프로필 이미지
} as const

/**
 * 파일 업로드 함수
 * @param file - 업로드할 파일
 * @param bucket - 저장할 버킷 이름
 * @param path - 파일 경로 (폴더/파일명)
 * @returns 업로드된 파일의 공개 URL
 */
export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // 파일 크기 검증
    if (file.size > FILE_UPLOAD.MAX_SIZE) {
      return {
        success: false,
        error: `파일 크기는 ${FILE_UPLOAD.MAX_SIZE / (1024 * 1024)}MB를 초과할 수 없습니다.`
      }
    }

    // 파일 타입 검증
    if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: '지원하지 않는 파일 형식입니다. (JPG, PNG, WebP만 가능)'
      }
    }

    // 파일 업로드
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true // 같은 이름 파일이 있으면 덮어쓰기
      })

    if (error) {
      console.error('File upload error:', error)
      return {
        success: false,
        error: '파일 업로드에 실패했습니다.'
      }
    }

    // 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return {
      success: true,
      url: publicUrl
    }

  } catch (error) {
    console.error('Upload function error:', error)
    return {
      success: false,
      error: '파일 업로드 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 파일 삭제 함수
 * @param bucket - 버킷 이름
 * @param path - 삭제할 파일 경로
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('File delete error:', error)
      return {
        success: false,
        error: '파일 삭제에 실패했습니다.'
      }
    }

    return { success: true }

  } catch (error) {
    console.error('Delete function error:', error)
    return {
      success: false,
      error: '파일 삭제 중 오류가 발생했습니다.'
    }
  }
}

/**
 * URL에서 파일 경로 추출
 * @param url - Supabase Storage URL
 * @returns 파일 경로
 */
export function getPathFromUrl(url: string): string {
  try {
    const urlParts = url.split('/storage/v1/object/public/')
    if (urlParts.length > 1) {
      const pathWithBucket = urlParts[1]
      const firstSlashIndex = pathWithBucket.indexOf('/')
      return pathWithBucket.substring(firstSlashIndex + 1)
    }
    return ''
  } catch {
    return ''
  }
}

/**
 * 사업자등록증 업로드 헬퍼
 * @param file - 업로드할 파일
 * @param userId - 사용자 ID
 */
export async function uploadBusinessLicense(file: File, userId: string) {
  const path = `${userId}/business-license-${Date.now()}.${file.name.split('.').pop()}`
  return uploadFile(file, STORAGE_BUCKETS.BUSINESS_LICENSES, path)
}

/**
 * 상품 이미지 업로드 헬퍼
 * @param file - 업로드할 파일
 * @param productId - 상품 ID
 * @param imageIndex - 이미지 순서 (썸네일은 0)
 */
export async function uploadProductImage(file: File, productId: string, imageIndex: number = 0) {
  const imageType = imageIndex === 0 ? 'thumbnail' : `image-${imageIndex}`
  const path = `${productId}/${imageType}-${Date.now()}.${file.name.split('.').pop()}`
  return uploadFile(file, STORAGE_BUCKETS.PRODUCT_IMAGES, path)
}

/**
 * 사용자 아바타 업로드 헬퍼
 * @param file - 업로드할 파일
 * @param userId - 사용자 ID
 */
export async function uploadUserAvatar(file: File, userId: string) {
  const path = `${userId}/avatar-${Date.now()}.${file.name.split('.').pop()}`
  return uploadFile(file, STORAGE_BUCKETS.USER_AVATARS, path)
} 