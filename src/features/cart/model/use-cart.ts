import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { CartItem, CartSummary } from '@/shared/types'

interface CartState {
  cartItems: CartItem[]
  addToCart: (item: Omit<CartItem, 'id' | 'totalPrice' | 'addedAt'>) => void
  removeFromCart: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  getCartSummary: () => CartSummary
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],

      addToCart: (item) => {
        const { cartItems } = get()
        const existingItemIndex = cartItems.findIndex(
          (cartItem) => 
            cartItem.productId === item.productId && 
            cartItem.color === item.color && 
            cartItem.size === item.size
        )

        if (existingItemIndex >= 0) {
          // 기존 아이템이 있으면 수량 증가
          const updatedItems = [...cartItems]
          updatedItems[existingItemIndex].quantity += item.quantity
          updatedItems[existingItemIndex].totalPrice = 
            updatedItems[existingItemIndex].unitPrice * updatedItems[existingItemIndex].quantity
          
          set({ cartItems: updatedItems })
        } else {
          // 새 아이템 추가
          const newItem: CartItem = {
            ...item,
            id: `cart_${Date.now()}_${Math.random()}`,
            totalPrice: item.unitPrice * item.quantity,
            addedAt: new Date().toISOString()
          }
          set({ cartItems: [...cartItems, newItem] })
        }
      },

      removeFromCart: (itemId) => {
        const { cartItems } = get()
        set({ cartItems: cartItems.filter(item => item.id !== itemId) })
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(itemId)
          return
        }

        const { cartItems } = get()
        const updatedItems = cartItems.map(item => 
          item.id === itemId 
            ? { ...item, quantity, totalPrice: item.unitPrice * quantity }
            : item
        )
        set({ cartItems: updatedItems })
      },

      clearCart: () => {
        set({ cartItems: [] })
      },

      getCartSummary: () => {
        const { cartItems } = get()
        const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
        const discountAmount = 0 // 할인 로직 추가 가능
        const finalAmount = totalAmount - discountAmount

        return {
          totalItems,
          totalAmount,
          discountAmount,
          finalAmount
        }
      }
    }),
    {
      name: 'cart-storage',
    }
  )
) 