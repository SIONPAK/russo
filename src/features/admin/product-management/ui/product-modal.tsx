'use client'

import { useState, useEffect } from 'react'
import { Product, CreateProductData, UpdateProductData, Category } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { FileUpload } from '@/shared/ui/file-upload'
import { 
  X, 
  Save, 
  Star, 
  TrendingUp, 
  Eye, 
  EyeOff,
  Image as ImageIcon,
  Trash2,
  Package,
  Plus,
  Upload
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { showSuccess, showError } from '@/shared/lib/toast'

// TinyMCE 에디터를 동적으로 로드 (SSR 방지)
const Editor = dynamic(() => import('@tinymce/tinymce-react').then(mod => ({ default: mod.Editor })), {
  ssr: false,
  loading: () => <div className="border border-gray-300 rounded-lg p-4 text-center">에디터 로딩 중...</div>
})

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateProductData | UpdateProductData) => Promise<void>
  product?: Product | null
  categories: Category[]
}

interface ProductImage {
  id?: string
  url: string
  altText: string
  isMain: boolean
  sortOrder: number
  file?: File
}

interface InventoryOption {
  color: string
  size: string
  stock_quantity: number
  additional_price?: number
}

export function ProductModal({ isOpen, onClose, onSave, product, categories }: ProductModalProps) {
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<ProductImage[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    detailed_description: '',
    category_id: '',
    code: '',
    price: 0,
    sale_price: 0,
    is_on_sale: false,
    is_featured: false,
    is_active: true,
    stock_quantity: 0,
    unit: '개',
    sku: '',
    weight: 0,
    dimensions: '',
    tags: [] as string[],
    meta_title: '',
    meta_description: ''
  })

  // 재고 관리 상태
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([])
  const [newOption, setNewOption] = useState({ color: '', size: '', stock_quantity: 0, additional_price: 0 })

  // 해시태그 입력 상태
  const [hashtagInput, setHashtagInput] = useState('')

  // 일괄 옵션 생성 상태
  const [bulkColorInput, setBulkColorInput] = useState('')
  const [bulkSizeInput, setBulkSizeInput] = useState('')
  const [bulkStockQuantity, setBulkStockQuantity] = useState(0)
  const [bulkAdditionalPrice, setBulkAdditionalPrice] = useState(0)

  // 이미지 업로드 상태
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

  // 상품 데이터로 폼 초기화
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        detailed_description: product.detailed_description || '',
        category_id: String(product.category_id || product.category?.id || ''),
        code: product.code || '',
        price: product.price || 0,
        sale_price: product.sale_price || 0,
        is_on_sale: product.is_on_sale || false,
        is_featured: product.is_featured || false,
        is_active: product.is_active ?? true,
        stock_quantity: product.stock_quantity || 0,
        unit: product.unit || '개',
        sku: product.sku || '',
        weight: product.weight || 0,
        dimensions: product.dimensions || '',
        tags: product.tags || [],
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || ''
      })

      // 기존 이미지 설정
      if (product.images) {
        const productImages: ProductImage[] = product.images.map((img, index) => ({
          id: img.id,
          url: img.image_url,
          altText: img.alt_text || '',
          isMain: img.is_main,
          sortOrder: img.sort_order || index + 1
        }))
        setImages(productImages)
      } else {
        setImages([])
      }

      // 기존 재고 옵션 설정
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        setInventoryOptions(product.inventory_options)
      } else {
        setInventoryOptions([])
      }
    } else {
      // 새 상품일 때 초기화
      setFormData({
        name: '',
        description: '',
        detailed_description: '',
        category_id: '',
        code: '',
        price: 0,
        sale_price: 0,
        is_on_sale: false,
        is_featured: false,
        is_active: true,
        stock_quantity: 0,
        unit: '개',
        sku: '',
        weight: 0,
        dimensions: '',
        tags: [],
        meta_title: '',
        meta_description: ''
      })
      setImages([])
      setInventoryOptions([])
    }
    setNewOption({ color: '', size: '', stock_quantity: 0, additional_price: 0 })
  }, [product, isOpen])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return

    // 현재 이미지 개수 + 새로 업로드할 이미지 개수가 10개를 초과하는지 확인
    if (images.length + files.length > 10) {
      showError(`최대 10개의 이미지만 업로드할 수 있습니다. (현재: ${images.length}개)`)
      return
    }

    try {
      setUploadingImages(true)
      setUploadProgress({ current: 0, total: files.length })
      
      // 5개씩 나누어 순차적으로 업로드
      const batchSize = 5
      const batches = []
      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize))
      }

      const allUploadedImages: ProductImage[] = []
      let currentImageIndex = images.length
      let processedFiles = 0

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        
        try {
          // FormData 생성
          const formData = new FormData()
          batch.forEach(file => {
            formData.append('files', file)
          })

          console.log(`배치 ${batchIndex + 1}/${batches.length} 업로드 중... (${batch.length}개 파일)`)

          // 이미지 업로드 API 호출
          const response = await fetch('/api/upload/product-images', {
            method: 'POST',
            body: formData
          })

          const result = await response.json()

          if (result.success && result.data.urls) {
            // 업로드된 이미지들을 배열에 추가
            const newImages: ProductImage[] = result.data.urls.map((url: string, index: number) => ({
              url,
              altText: '',
              isMain: images.length === 0 && allUploadedImages.length === 0 && index === 0, // 첫 번째 이미지가 없으면 첫 번째 업로드 이미지를 메인으로
              sortOrder: currentImageIndex + index + 1
            }))

            allUploadedImages.push(...newImages)
            currentImageIndex += newImages.length
            processedFiles += batch.length
            
            console.log(`배치 ${batchIndex + 1} 업로드 완료: ${newImages.length}개`)
            
            // 진행 상황 업데이트
            setUploadProgress({ current: processedFiles, total: files.length })
            
            // 중간 결과를 UI에 반영
            setImages(prev => [...prev, ...newImages])
          } else {
            throw new Error(result.error || `배치 ${batchIndex + 1} 업로드 실패`)
          }
        } catch (batchError) {
          console.error(`배치 ${batchIndex + 1} 업로드 오류:`, batchError)
          showError(`배치 ${batchIndex + 1} 업로드 중 오류가 발생했습니다: ${batchError}`)
          processedFiles += batch.length
          setUploadProgress({ current: processedFiles, total: files.length })
          // 오류가 발생해도 다음 배치 계속 진행
        }
      }

      if (allUploadedImages.length > 0) {
        showSuccess(`${allUploadedImages.length}개의 이미지가 성공적으로 업로드되었습니다.`)
      } else {
        showError('모든 이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Image upload error:', error)
      showError('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingImages(false)
      setUploadProgress({ current: 0, total: 0 })
    }
  }

  const handleImageDelete = (index: number) => {
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index)
      // 메인 이미지가 삭제되면 첫 번째 이미지를 메인으로 설정
      if (prev[index].isMain && newImages.length > 0) {
        newImages[0].isMain = true
      }
      return newImages
    })
  }

  const handleSetMainImage = (index: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isMain: i === index
    })))
  }

  // 재고 옵션 관리
  const addInventoryOption = () => {
    if (!newOption.color || !newOption.size) {
      alert('색상과 사이즈를 모두 입력해주세요.')
      return
    }
    
    const exists = inventoryOptions.some(
      opt => opt.color === newOption.color && opt.size === newOption.size
    )
    
    if (exists) {
      alert('이미 존재하는 색상/사이즈 조합입니다.')
      return
    }

    setInventoryOptions(prev => [...prev, { ...newOption }])
    setNewOption({ color: '', size: '', stock_quantity: 0, additional_price: 0 })
  }

  // 일괄 옵션 생성 함수
  const generateBulkOptions = () => {
    if (!bulkColorInput.trim() || !bulkSizeInput.trim()) {
      alert('색상과 사이즈를 모두 입력해주세요.')
      return
    }

    // 콤마로 구분하여 배열로 변환
    const colors = bulkColorInput.split(',').map(c => c.trim()).filter(c => c.length > 0)
    const sizes = bulkSizeInput.split(',').map(s => s.trim()).filter(s => s.length > 0)

    if (colors.length === 0 || sizes.length === 0) {
      alert('유효한 색상과 사이즈를 입력해주세요.')
      return
    }

    // 모든 조합 생성
    const newOptions: InventoryOption[] = []
    colors.forEach(color => {
      sizes.forEach(size => {
        // 중복 체크
        const exists = inventoryOptions.some(
          opt => opt.color === color && opt.size === size
        )
        
        if (!exists) {
          newOptions.push({
            color,
            size,
            stock_quantity: bulkStockQuantity,
            additional_price: bulkAdditionalPrice
          })
        }
      })
    })

    if (newOptions.length === 0) {
      alert('생성할 새로운 옵션이 없습니다. (모든 조합이 이미 존재)')
      return
    }

    // 기존 옵션에 추가
    setInventoryOptions(prev => [...prev, ...newOptions])
    
    // 입력 필드 초기화
    setBulkColorInput('')
    setBulkSizeInput('')
    setBulkStockQuantity(0)
    setBulkAdditionalPrice(0)

    alert(`${newOptions.length}개의 옵션이 생성되었습니다.`)
  }

  const removeInventoryOption = (index: number) => {
    setInventoryOptions(prev => prev.filter((_, i) => i !== index))
  }

  const updateInventoryOption = (index: number, field: keyof InventoryOption, value: string | number) => {
    setInventoryOptions(prev => prev.map((opt, i) => 
      i === index ? { ...opt, [field]: value } : opt
    ))
  }

  // 해시태그 처리 함수
  const handleHashtagInput = (value: string) => {
    setHashtagInput(value)
  }

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addHashtagFromInput()
    }
  }

  const addHashtagFromInput = () => {
    const newTags = hashtagInput
      .split(/[,\s]+/) // 쉼표와 스페이스로 분리
      .map(tag => tag.replace(/^#+/, '').trim()) // 앞의 # 제거하고 공백 제거
      .filter(tag => tag.length > 0 && !formData.tags.includes(tag)) // 빈 문자열과 중복 제거

    if (newTags.length > 0) {
      handleInputChange('tags', [...formData.tags, ...newTags])
      setHashtagInput('')
    }
  }

  const removeHashtag = (indexToRemove: number) => {
    const newTags = formData.tags.filter((_, index) => index !== indexToRemove)
    handleInputChange('tags', newTags)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.code || !formData.category_id || !formData.price) {
      alert('필수 필드를 모두 입력해주세요.')
      return
    }

    // 재고 옵션 검증
    if (inventoryOptions.length === 0) {
      alert('최소 하나의 재고 옵션을 추가해주세요.')
      return
    }

    setLoading(true)

    try {
      // 상품 데이터 준비 (이미지 정보 포함)
      const productData = {
        ...formData,
        id: product?.id,
        images: images.map(img => ({
          id: img.id,
          image_url: img.url,
          alt_text: img.altText,
          is_main: img.isMain,
          sort_order: img.sortOrder
        })),
        inventory_options: inventoryOptions
      }

      await onSave(productData)
      onClose()
    } catch (error) {
      console.error('Product save error:', error)
      alert('상품 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {product ? '상품 수정' : '상품 추가'}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* 기본 정보 */}
          <div className="border border-gray-200 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품명 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="상품명을 입력하세요"
                  className="h-12"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 코드 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  placeholder="상품 코드를 입력하세요"
                  className="h-12"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => handleInputChange('category_id', e.target.value)}
                  className="w-full h-12 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">카테고리를 선택하세요</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단위
                </label>
                <Input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => handleInputChange('unit', e.target.value)}
                  placeholder="개, 세트, kg 등"
                  className="h-12"
                />
              </div>
            </div>
          </div>

          {/* 가격 정보 */}
          <div className="border border-gray-200 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">가격 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  정가 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="h-12"
                  min="0"
                  step="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  세일가
                </label>
                <Input
                  type="number"
                  value={formData.sale_price}
                  onChange={(e) => handleInputChange('sale_price', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="h-12"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            {/* 상품 특성 */}
            <div className="bg-gray-50 rounded-lg p-4 mt-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">상품 특성</h4>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 flex items-center">
                    <Star className="w-4 h-4 mr-1 text-yellow-500" />
                    인기상품
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_on_sale}
                    onChange={(e) => handleInputChange('is_on_sale', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1 text-red-500" />
                    세일 상품
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 flex items-center">
                    {formData.is_active ? <Eye className="w-4 h-4 mr-1 text-green-500" /> : <EyeOff className="w-4 h-4 mr-1 text-gray-400" />}
                    판매 활성화
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* 재고 관리 */}
          <div className="border border-gray-200 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">재고 관리</h3>
            
            {/* 옵션별 재고 관리 */}
            <div className="space-y-4">
              {/* 일괄 옵션 생성 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-blue-600" />
                  일괄 옵션 생성
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  콤마(,)로 구분하여 입력하면 모든 조합이 자동으로 생성됩니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      색상 (콤마로 구분)
                    </label>
                    <Input
                      value={bulkColorInput}
                      onChange={(e) => setBulkColorInput(e.target.value)}
                      placeholder="예: 블랙,백메란지,그레이"
                      className="border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      사이즈 (콤마로 구분)
                    </label>
                    <Input
                      value={bulkSizeInput}
                      onChange={(e) => setBulkSizeInput(e.target.value)}
                      placeholder="예: FREE 또는 1번,2번"
                      className="border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      기본 재고 수량
                    </label>
                    <Input
                      type="number"
                      value={bulkStockQuantity}
                      onChange={(e) => setBulkStockQuantity(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      className="border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      추가 가격 (원)
                    </label>
                    <Input
                      type="number"
                      value={bulkAdditionalPrice}
                      onChange={(e) => setBulkAdditionalPrice(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      className="border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={generateBulkOptions}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      자동 생성
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  예시: 색상 "블랙,백메란지,그레이", 사이즈 "FREE" → 3개 옵션 생성
                  <br />
                  예시: 색상 "블랙,백메란지", 사이즈 "1번,2번" → 4개 옵션 생성
                  <br />
                  <strong>추가 가격:</strong> 3XL, 4XL 등 특정 사이즈의 추가 금액 (예: 500원, 1000원)
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">개별 옵션 추가</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      색상
                    </label>
                    <Input
                      value={newOption.color}
                      onChange={(e) => setNewOption(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="예: 503 블랙"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      사이즈
                    </label>
                    <Input
                      value={newOption.size}
                      onChange={(e) => setNewOption(prev => ({ ...prev, size: e.target.value }))}
                      placeholder="예: S, M, L"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수량
                    </label>
                    <Input
                      type="number"
                      value={newOption.stock_quantity}
                      onChange={(e) => setNewOption(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      추가 가격 (원)
                    </label>
                    <Input
                      type="number"
                      value={newOption.additional_price || 0}
                      onChange={(e) => setNewOption(prev => ({ ...prev, additional_price: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={addInventoryOption}
                      className="w-full"
                    >
                      추가
                    </Button>
                  </div>
                </div>
              </div>

              {inventoryOptions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          색상
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          사이즈
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          수량
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          추가 가격 (원)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          액션
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inventoryOptions.map((option, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">
                            <Input
                              value={option.color}
                              onChange={(e) => updateInventoryOption(index, 'color', e.target.value)}
                              className="text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={option.size}
                              onChange={(e) => updateInventoryOption(index, 'size', e.target.value)}
                              className="text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={option.stock_quantity}
                              onChange={(e) => updateInventoryOption(index, 'stock_quantity', parseInt(e.target.value) || 0)}
                              className="text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={option.additional_price || 0}
                              onChange={(e) => updateInventoryOption(index, 'additional_price', parseInt(e.target.value) || 0)}
                              className="text-sm"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeInventoryOption(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              삭제
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 상품 이미지 */}
          <div className="border border-gray-200 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">상품 이미지 (최대 10개)</h3>
            
            {/* 이미지 업로드 영역 */}
            {images.length < 10 && (
              <div className="mb-4">
                {uploadingImages ? (
                  // 업로드 진행 중 UI
                  <div className="border-2 border-blue-300 rounded-lg p-8 text-center bg-blue-50">
                    <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-blue-700 mb-2 font-medium">이미지 업로드 중...</p>
                    <p className="text-sm text-blue-600 mb-4">
                      {uploadProgress.current}/{uploadProgress.total} 파일 처리 완료
                    </p>
                    {/* 진행 바 */}
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  // 일반 업로드 UI
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">이미지를 드래그하거나 클릭하여 업로드</p>
                    <p className="text-sm text-gray-500">JPG, PNG, WebP (최대 5MB, {10 - images.length}개 추가 가능)</p>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length > 0) {
                          handleImageUpload(files)
                        }
                      }}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 업로드된 이미지 목록 */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                      <img
                        src={image.url}
                        alt={image.altText || `상품 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* 이미지 컨트롤 */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                      {!image.isMain && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSetMainImage(index)}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
                        >
                          메인 설정
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImageDelete(index)}
                        className="bg-red-500 hover:bg-red-600 text-white p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* 메인 이미지 표시 */}
                    {image.isMain && (
                      <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        메인
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 상품 설명 및 해시태그 */}
          <div className="border border-gray-200 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">상품 정보</h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  해시태그
                </label>
                <div className="space-y-3">
                  <Input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => handleHashtagInput(e.target.value)}
                    onKeyDown={handleHashtagKeyDown}
                    placeholder="예: 인기상품, 신상품, 할인 (쉼표나 스페이스로 구분, 엔터로 추가)"
                    className="h-12"
                  />
                  <p className="text-xs text-gray-500">
                    태그를 스페이스(공백), 쉼표(,), 엔터로 구분하여 입력하세요. 검색과 분류에 도움이 됩니다.
                  </p>
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors"
                          onClick={() => removeHashtag(index)}
                          title="클릭하여 삭제"
                        >
                          #{tag}
                          <X className="w-3 h-3 ml-1" />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 상세설명 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">상세설명</label>
            <Editor
              apiKey="0t68kcm68pz2n5zz8rrifdmdazpfevqcgfuysgy7ku94iut4"
              value={formData.detailed_description}
              onEditorChange={(content) => setFormData({...formData, detailed_description: content})}
              init={{
                height: 400,
                menubar: false,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic forecolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'image link | removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                branding: false,
                promotion: false,
                images_upload_handler: async (blobInfo: any) => {
                  return new Promise(async (resolve, reject) => {
                    try {
                      const formData = new FormData()
                      formData.append('files', blobInfo.blob(), blobInfo.filename())
                      
                      const response = await fetch('/api/upload/product-images', {
                        method: 'POST',
                        body: formData
                      })
                      
                      const result = await response.json()
                      
                      if (result.success && result.data.urls && result.data.urls.length > 0) {
                        resolve(result.data.urls[0])
                      } else {
                        reject('이미지 업로드에 실패했습니다.')
                      }
                    } catch (error) {
                      reject('이미지 업로드 중 오류가 발생했습니다.')
                    }
                  })
                },
                images_upload_base_path: '',
                automatic_uploads: true
              }}
            />
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || uploadingImages}
              className="px-6 py-2 rounded-xl"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading || uploadingImages}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading || uploadingImages ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadingImages ? '이미지 업로드 중...' : '저장 중...'}
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  {product ? '수정하기' : '저장하기'}
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 