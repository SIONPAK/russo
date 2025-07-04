'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Calendar } from 'lucide-react'
import { usePopupManagement } from '@/features/admin/popup-management/model/use-popup-management'
import { PopupModal } from '@/features/admin/popup-management/ui/popup-modal'

export function PopupsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedPopup, setSelectedPopup] = useState<any>(null)

  const {
    popups,
    loading,
    createPopup,
    updatePopup,
    deletePopup,
    toggleActive
  } = usePopupManagement()

  const filteredPopups = popups.filter(popup =>
    popup.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreate = () => {
    setSelectedPopup(null)
    setShowModal(true)
  }

  const handleEdit = (popup: any) => {
    setSelectedPopup(popup)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 팝업을 삭제하시겠습니까?')) {
      await deletePopup(id)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await toggleActive(id, !isActive)
  }

  const handleSave = async (data: any) => {
    if (selectedPopup) {
      await updatePopup(selectedPopup.id, data)
    } else {
      await createPopup(data)
    }
    setShowModal(false)
    setSelectedPopup(null)
  }

  const isPopupActive = (popup: any) => {
    const now = new Date()
    const startDate = new Date(popup.start_date)
    const endDate = new Date(popup.end_date)
    return popup.is_active && now >= startDate && now <= endDate
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">팝업 관리</h1>
        <Button onClick={handleCreate} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>팝업 생성</span>
        </Button>
      </div>

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="팝업 제목으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 팝업 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  팝업 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  표시 기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredPopups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    팝업이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredPopups.map((popup) => (
                  <tr key={popup.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          <img
                            className="h-12 w-12 rounded object-cover"
                            src={popup.image_url}
                            alt={popup.title}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {popup.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(popup.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {popup.width} × {popup.height}px
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        <div>
                          <div>{new Date(popup.start_date).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">
                            ~ {new Date(popup.end_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isPopupActive(popup)
                          ? 'bg-green-100 text-green-800'
                          : popup.is_active
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isPopupActive(popup) ? '활성' : popup.is_active ? '대기' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleActive(popup.id, popup.is_active)}
                          className={`p-1 rounded hover:bg-gray-100 ${
                            popup.is_active ? 'text-green-600' : 'text-gray-400'
                          }`}
                          title={popup.is_active ? '비활성화' : '활성화'}
                        >
                          {popup.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(popup)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="수정"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(popup.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 팝업 생성/수정 모달 */}
      {showModal && (
        <PopupModal
          popup={selectedPopup}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false)
            setSelectedPopup(null)
          }}
        />
      )}
    </div>
  )
} 