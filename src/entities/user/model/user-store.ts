import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  id: string
  email: string
  company_name: string
  business_number: string
  representative_name: string
  phone: string
  address: string
  postal_code: string
  recipient_name: string
  recipient_phone: string
}

export interface ShippingAddress {
  id: string
  name: string
  phone: string
  address: string
  postal_code: string
  is_default: boolean
}

interface UserState {
  profile: UserProfile | null
  shippingAddresses: ShippingAddress[]
  defaultShippingAddress: ShippingAddress | null
  setProfile: (profile: UserProfile) => void
  setShippingAddresses: (addresses: ShippingAddress[]) => void
  addShippingAddress: (address: Omit<ShippingAddress, 'id'>) => void
  updateShippingAddress: (id: string, address: Partial<ShippingAddress>) => void
  deleteShippingAddress: (id: string) => void
  setDefaultShippingAddress: (id: string) => void
  getDefaultShippingAddress: () => ShippingAddress | null
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      shippingAddresses: [],
      defaultShippingAddress: null,

      setProfile: (profile) => {
        set({ profile })
        
        // 프로필에서 기본 배송지 정보 추출
        const defaultAddress: ShippingAddress = {
          id: 'default',
          name: profile.recipient_name || profile.representative_name,
          phone: profile.recipient_phone || profile.phone,
          address: profile.address,
          postal_code: profile.postal_code,
          is_default: true
        }
        
        set({ defaultShippingAddress: defaultAddress })
      },

      setShippingAddresses: (addresses) => {
        set({ shippingAddresses: addresses })
        
        // 기본 배송지 찾기
        const defaultAddr = addresses.find(addr => addr.is_default)
        if (defaultAddr) {
          set({ defaultShippingAddress: defaultAddr })
        }
      },

      addShippingAddress: (address) => {
        const newAddress: ShippingAddress = {
          ...address,
          id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        
        const { shippingAddresses } = get()
        
        // 첫 번째 주소이거나 기본 주소로 설정된 경우
        if (shippingAddresses.length === 0 || address.is_default) {
          // 기존 기본 주소 해제
          const updatedAddresses = shippingAddresses.map(addr => 
            ({ ...addr, is_default: false })
          )
          set({ 
            shippingAddresses: [...updatedAddresses, newAddress],
            defaultShippingAddress: newAddress
          })
        } else {
          set({ shippingAddresses: [...shippingAddresses, newAddress] })
        }
      },

      updateShippingAddress: (id, updates) => {
        const { shippingAddresses } = get()
        const updatedAddresses = shippingAddresses.map(addr => 
          addr.id === id ? { ...addr, ...updates } : addr
        )
        
        set({ shippingAddresses: updatedAddresses })
        
        // 기본 주소가 업데이트된 경우
        if (updates.is_default) {
          const updatedAddr = updatedAddresses.find(addr => addr.id === id)
          if (updatedAddr) {
            // 다른 주소들의 기본 설정 해제
            const finalAddresses = updatedAddresses.map(addr => 
              addr.id !== id ? { ...addr, is_default: false } : addr
            )
            set({ 
              shippingAddresses: finalAddresses,
              defaultShippingAddress: updatedAddr 
            })
          }
        }
      },

      deleteShippingAddress: (id) => {
        const { shippingAddresses, defaultShippingAddress } = get()
        const filteredAddresses = shippingAddresses.filter(addr => addr.id !== id)
        
        set({ shippingAddresses: filteredAddresses })
        
        // 삭제된 주소가 기본 주소였다면 새로운 기본 주소 설정
        if (defaultShippingAddress?.id === id) {
          const newDefault = filteredAddresses.find(addr => addr.is_default) || filteredAddresses[0] || null
          set({ defaultShippingAddress: newDefault })
        }
      },

      setDefaultShippingAddress: (id) => {
        const { shippingAddresses } = get()
        const updatedAddresses = shippingAddresses.map(addr => ({
          ...addr,
          is_default: addr.id === id
        }))
        
        const defaultAddr = updatedAddresses.find(addr => addr.id === id)
        
        set({ 
          shippingAddresses: updatedAddresses,
          defaultShippingAddress: defaultAddr || null
        })
      },

      getDefaultShippingAddress: () => {
        const { defaultShippingAddress, shippingAddresses } = get()
        return defaultShippingAddress || shippingAddresses.find(addr => addr.is_default) || null
      }
    }),
    {
      name: 'user-storage',
    }
  )
) 