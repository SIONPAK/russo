'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Image as ImageIcon,
  Monitor,
  Smartphone,
  ExternalLink
} from 'lucide-react'
import { useBannerManagement } from '@/features/admin/banner-management/model/use-banner-management'
import { BannerModal } from '@/features/admin/banner-management/ui/banner-modal'
import { formatDateTime } from '@/shared/lib/utils'

export function BannersPage() {
  const {
    banners,
    loading,
    updating,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    uploadImage,
  } = useBannerManagement()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBanner, setSelectedBanner] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredBanners = banners.filter(banner =>
    banner.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEdit = (banner) => {
    setSelectedBanner(banner)
    setModalOpen(true)
  }

  const handleDelete = async (banner) => {
    if (confirm(`"${banner.title}" 배너를 삭제하시겠습니까?`)) {
      await deleteBanner(banner.id)
    }
  }

  const handleToggleStatus = async (banner) => {
    await toggleBannerStatus(banner.id, !banner.is_active)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedBanner(null)
  }

  const handleSave = async (data) => {
    if (selectedBanner) {
      return await updateBanner(selectedBanner.id, data)
    } else {
      return await createBanner(data)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">배너 관리</h1>
        <p className="text-gray-600 mt-2">메인 페이지에 표시될 배너를 관리합니다</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="배너 제목 검색"
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          배너 추가
        </Button>
      </div>

      {/* 배너 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            배너 목록 ({filteredBanners.length}개)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">배너 목록을 불러오는 중...</p>
          </div>
        ) : filteredBanners.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>등록된 배너가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    배너 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이미지 미리보기
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    링크 URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    순서
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBanners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{banner.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <div className="relative group">
                          <img
                            src={banner.desktop_image}
                            alt="데스크톱 배너"
                            className="w-16 h-9 object-cover rounded border cursor-pointer"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <Monitor className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="relative group">
                          <img
                            src={banner.mobile_image}
                            alt="모바일 배너"
                            className="w-16 h-9 object-cover rounded border cursor-pointer"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <Smartphone className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {banner.link_url ? (
                        <a
                          href={banner.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          링크 이동
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {banner.order_index}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(banner)}
                        disabled={updating}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          banner.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {banner.is_active ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            활성화
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            비활성화
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(banner.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(banner)}
                        disabled={updating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(banner)}
                        disabled={updating}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 배너 모달 */}
      <BannerModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        banner={selectedBanner}
        onSave={handleSave}
        onUploadImage={uploadImage}
        updating={updating}
      />
    </div>
  )
}
