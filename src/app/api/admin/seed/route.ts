import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // 기존 관리자 계정 확인
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id, username, email, role')
      .eq('username', 'admin')
      .single()

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: '관리자 계정이 이미 존재합니다.',
        data: {
          id: existingAdmin.id,
          username: existingAdmin.username,
          email: existingAdmin.email,
          role: existingAdmin.role,
          status: 'already_exists'
        }
      }, { status: 200 })
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash('admin123!', 12)

    // 관리자 계정 생성
    const { data: admin, error } = await supabase
      .from('admins')
      .insert({
        username: 'admin',
        email: 'admin@lusso.com',
        password_hash: hashedPassword,
        role: 'super_admin'
      })
      .select()
      .single()

    if (error) {
      console.error('관리자 계정 생성 오류:', error)
      return NextResponse.json(
        { success: false, message: '관리자 계정 생성에 실패했습니다.', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '관리자 계정이 생성되었습니다.',
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    }, { status: 201 })

  } catch (error) {
    console.error('관리자 계정 생성 API 오류:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 