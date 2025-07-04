import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// PUT - 카테고리 메뉴 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const { id } = await params
    const body = await request.json()

    const {
      name,
      key,
      path,
      order_index,
      is_active,
      is_special,
      badge,
      text_color
    } = body

    // 필수 필드 검증
    if (!name || !key || !path) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 다른 카테고리에서 같은 키 사용 중인지 확인
    const { data: existingCategory } = await supabase
      .from('category_menus')
      .select('id')
      .eq('key', key)
      .neq('id', id)
      .single()

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 메뉴 키입니다.' },
        { status: 400 }
      )
    }

    // 기존 카테고리 정보 조회 (이름이 변경되었는지 확인하기 위함)
    const { data: oldCategory } = await supabase
      .from('category_menus')
      .select('name, key')
      .eq('id', id)
      .single()

    const { data: category, error } = await supabase
      .from('category_menus')
      .update({
        name,
        key,
        path,
        order_index,
        is_active,
        is_special,
        badge: badge || null,
        text_color: text_color || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Category update error:', error)
      return NextResponse.json(
        { success: false, error: '카테고리 메뉴 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 카테고리 이름이나 키가 변경된 경우, 해당 카테고리를 사용하는 상품들의 카테고리 정보도 업데이트
    if (oldCategory && (oldCategory.name !== name || oldCategory.key !== key)) {
      const { error: productUpdateError } = await supabase
        .from('products')
        .update({
          category: name, // 상품 테이블의 category 필드 업데이트 (있는 경우)
          updated_at: new Date().toISOString()
        })
        .eq('category_id', id)

      if (productUpdateError) {
        console.error('Products category update error:', productUpdateError)
        // 상품 업데이트 실패해도 카테고리 수정은 성공으로 처리
        // 단, 경고 메시지 추가
        return NextResponse.json({
          success: true,
          data: category,
          message: '카테고리 메뉴가 수정되었지만, 일부 상품의 카테고리 정보 업데이트에 실패했습니다. 상품 관리에서 확인해주세요.'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: category,
      message: '카테고리 메뉴가 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Category update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE - 카테고리 메뉴 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const { id } = await params

    // 먼저 해당 카테고리를 사용하는 상품이 있는지 확인
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('category_id', id)

    if (productError) {
      console.error('Products check error:', productError)
      return NextResponse.json(
        { success: false, error: '상품 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 해당 카테고리를 사용하는 상품이 있으면 삭제 방지
    if (products && products.length > 0) {
      const productNames = products.slice(0, 3).map(p => p.name).join(', ')
      const moreCount = products.length > 3 ? ` 외 ${products.length - 3}개` : ''
      
      return NextResponse.json(
        { 
          success: false, 
          error: `이 카테고리를 사용하는 상품이 ${products.length}개 있습니다. (${productNames}${moreCount})\n먼저 해당 상품들의 카테고리를 변경하거나 삭제해주세요.` 
        },
        { status: 400 }
      )
    }

    // 상품이 없으면 카테고리 삭제 진행
    const { error } = await supabase
      .from('category_menus')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Category delete error:', error)
      return NextResponse.json(
        { success: false, error: '카테고리 메뉴 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '카테고리 메뉴가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Category delete API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 