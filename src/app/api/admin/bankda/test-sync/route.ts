import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase';
import { getCurrentKoreanDateTime } from '@/shared/lib/utils';

// POST - 뱅크다 동기화 테스트 (06-01 ~ 오늘)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 테스트용 뱅크다 데이터 시뮬레이션
    const testData = [
      {
        external_id: `test_${Date.now()}_1`,
        business_name: '테스트 업체 1',
        amount: 50000,
        transaction_date: getCurrentKoreanDateTime(),
        description: '테스트 마일리지 적립'
      },
      {
        external_id: `test_${Date.now()}_2`,
        business_name: '테스트 업체 2',
        amount: 30000,
        transaction_date: getCurrentKoreanDateTime(),
        description: '테스트 마일리지 적립'
      }
    ];

    const results = [];
    const errors = [];

    for (const transaction of testData) {
      try {
        // 1. 사용자 확인 (업체명으로 검색)
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id, company_name')
          .ilike('company_name', `%${transaction.business_name}%`)
          .limit(1);

        if (userError) {
          errors.push(`사용자 검색 오류: ${transaction.business_name}`);
          continue;
        }

        if (!users || users.length === 0) {
          errors.push(`사용자를 찾을 수 없음: ${transaction.business_name}`);
          continue;
        }

        const user = users[0];

        // 2. 중복 거래 확인
        const { data: existingMileage, error: duplicateError } = await supabase
          .from('mileage')
          .select('id')
          .eq('source', 'auto')
          .eq('description', transaction.description)
          .eq('user_id', user.id)
          .eq('amount', transaction.amount)
          .limit(1);

        if (duplicateError) {
          errors.push(`중복 확인 오류: ${transaction.external_id}`);
          continue;
        }

        if (existingMileage && existingMileage.length > 0) {
          errors.push(`중복 거래: ${transaction.external_id}`);
          continue;
        }

        // 3. 마일리지 자동 등록 (대기 상태)
        const { data: mileage, error: mileageError } = await supabase
          .from('mileage')
          .insert({
            user_id: user.id,
            amount: transaction.amount,
            type: 'earn',
            source: 'auto',
            description: `뱅크다 자동 적립: ${transaction.description}`,
            status: 'pending', // 관리자 승인 대기
            order_id: transaction.external_id,
            created_at: transaction.transaction_date,
            updated_at: transaction.transaction_date
          })
          .select()
          .single();

        if (mileageError) {
          errors.push(`마일리지 등록 오류: ${transaction.external_id}`);
          continue;
        }

        // 4. 로그 기록
        await supabase
          .from('mileage_logs')
          .insert({
            user_id: user.id,
            type: 'bankda_sync',
            amount: transaction.amount,
            reason: '뱅크다 자동 동기화 테스트',
            reference_id: mileage.id,
            reference_type: 'mileage',
            description: `외부 거래 ID: ${transaction.external_id}`
          });

        results.push({
          external_id: transaction.external_id,
          user_id: user.id,
          company_name: user.company_name,
          amount: transaction.amount,
          status: 'success',
          mileage_id: mileage.id
        });

      } catch (error) {
        console.error('개별 거래 처리 오류:', error);
        errors.push(`처리 오류: ${transaction.external_id}`);
      }
    }

    // 5. 뱅크다 설정 업데이트 (마지막 동기화 시간)
    await supabase
      .from('admin_settings')
      .upsert({
        key: 'bankda_last_sync',
        value: getCurrentKoreanDateTime(),
        updated_at: getCurrentKoreanDateTime()
      });

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        errorCount: errors.length,
        results,
        errors
      },
      message: `테스트 완료: ${results.length}건 성공, ${errors.length}건 오류`
    });

  } catch (error) {
    console.error('뱅크다 테스트 동기화 오류:', error);
    return NextResponse.json({
      success: false,
      error: '뱅크다 테스트 동기화 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
} 