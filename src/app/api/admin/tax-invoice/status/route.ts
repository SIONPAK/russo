import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { businessName, yearMonth, status } = await request.json();

    if (!businessName || !yearMonth || !status) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000));

    // 기존 상태 확인
    const { data: existing, error: selectError } = await supabase
      .from('tax_invoice_status')
      .select('*')
      .eq('company_name', businessName)
      .eq('year_month', yearMonth)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('세금계산서 상태 조회 오류:', selectError);
      return NextResponse.json(
        { success: false, error: '세금계산서 상태 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (existing) {
      // 업데이트
      const { error: updateError } = await supabase
        .from('tax_invoice_status')
        .update({
          status,
          issued_at: status === 'O' ? koreaTime.toISOString() : null,
          issued_by: status === 'O' ? 'admin' : null,
          updated_at: koreaTime.toISOString()
        })
        .eq('company_name', businessName)
        .eq('year_month', yearMonth);

      if (updateError) {
        console.error('세금계산서 상태 업데이트 오류:', updateError);
        return NextResponse.json(
          { success: false, error: '세금계산서 상태 업데이트 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    } else {
      // 신규 생성
      const { error: insertError } = await supabase
        .from('tax_invoice_status')
        .insert({
          company_name: businessName,
          year_month: yearMonth,
          status,
          issued_at: status === 'O' ? koreaTime.toISOString() : null,
          issued_by: status === 'O' ? 'admin' : null,
          created_at: koreaTime.toISOString(),
          updated_at: koreaTime.toISOString()
        });

      if (insertError) {
        console.error('세금계산서 상태 생성 오류:', insertError);
        return NextResponse.json(
          { success: false, error: '세금계산서 상태 생성 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '세금계산서 상태가 변경되었습니다.'
    });

  } catch (error) {
    console.error('세금계산서 상태 변경 오류:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 