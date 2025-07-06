import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { businessNames, yearMonth, status } = await request.json();

    if (!businessNames || !Array.isArray(businessNames) || businessNames.length === 0 || !yearMonth || !status) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000));
    let successCount = 0;
    let errorCount = 0;

    for (const businessName of businessNames) {
      try {
        // 기존 상태 확인
        const { data: existing, error: selectError } = await supabase
          .from('tax_invoice_status')
          .select('*')
          .eq('company_name', businessName)
          .eq('year_month', yearMonth)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error(`세금계산서 상태 조회 오류 (${businessName}):`, selectError);
          errorCount++;
          continue;
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
            console.error(`세금계산서 상태 업데이트 오류 (${businessName}):`, updateError);
            errorCount++;
            continue;
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
            console.error(`세금계산서 상태 생성 오류 (${businessName}):`, insertError);
            errorCount++;
            continue;
          }
        }

        successCount++;
      } catch (error) {
        console.error(`세금계산서 상태 처리 오류 (${businessName}):`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount,
        errorCount,
        totalCount: businessNames.length
      },
      message: `일괄 상태 변경 완료: 성공 ${successCount}건, 실패 ${errorCount}건`
    });

  } catch (error) {
    console.error('세금계산서 일괄 상태 변경 오류:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 일괄 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 