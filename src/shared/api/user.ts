import { supabase } from '@/shared/lib/supabase'
import { UserProfile, ShippingAddress } from '@/entities/user/model/user-store'

// 유저 프로필 조회
export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data as UserProfile
  } catch (error) {
    console.error('사용자 프로필 조회 오류:', error)
    return null
  }
}

// 배송지 목록 조회
export const fetchShippingAddresses = async (userId: string): Promise<ShippingAddress[]> => {
  try {
    const { data, error } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })

    if (error) throw error
    
    return (data || []).map(item => ({
      id: item.id,
      name: item.recipient_name,
      phone: item.phone,
      address: item.address,
      postal_code: item.postal_code,
      is_default: item.is_default
    }))
  } catch (error) {
    console.error('배송지 목록 조회 오류:', error)
    return []
  }
}

// 배송지 추가
export const createShippingAddress = async (
  userId: string, 
  address: Omit<ShippingAddress, 'id'>
): Promise<ShippingAddress | null> => {
  try {
    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (address.is_default) {
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('shipping_addresses')
      .insert({
        user_id: userId,
        recipient_name: address.name,
        phone: address.phone,
        address: address.address,
        postal_code: address.postal_code,
        is_default: address.is_default
      })
      .select()
      .single()

    if (error) throw error
    
    return {
      id: data.id,
      name: data.recipient_name,
      phone: data.phone,
      address: data.address,
      postal_code: data.postal_code,
      is_default: data.is_default
    }
  } catch (error) {
    console.error('배송지 추가 오류:', error)
    return null
  }
}

// 배송지 수정
export const updateShippingAddress = async (
  addressId: string,
  userId: string,
  updates: Partial<ShippingAddress>
): Promise<boolean> => {
  try {
    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (updates.is_default) {
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
        .neq('id', addressId)
    }

    const updateData: any = {}
    if (updates.name !== undefined) updateData.recipient_name = updates.name
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.address !== undefined) updateData.address = updates.address
    if (updates.postal_code !== undefined) updateData.postal_code = updates.postal_code
    if (updates.is_default !== undefined) updateData.is_default = updates.is_default

    const { error } = await supabase
      .from('shipping_addresses')
      .update(updateData)
      .eq('id', addressId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('배송지 수정 오류:', error)
    return false
  }
}

// 배송지 삭제
export const deleteShippingAddress = async (addressId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shipping_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('배송지 삭제 오류:', error)
    return false
  }
} 