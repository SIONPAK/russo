import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/shared/lib/supabase"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { data: notice, error } = await supabase
      .from("notices")
      .update(body)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: "공지사항 수정에 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notice
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabase
      .from("notices")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { success: false, error: "공지사항 삭제에 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "공지사항이 성공적으로 삭제되었습니다."
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
