import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 회사별 총 마일리지 계산 쿼리
    const { data: totalPoints, error } = await supabase
      .from('mileage')
      .select(`
        amount,
        type,
        users!inner(
          id,
          company_name,
          representative_name
        )
      `)
      .eq('status', 'completed');

    if (error) {
      console.error('Total points query error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch total points'
      }, { status: 500 });
    }

    // 회사별로 그룹핑하여 총 마일리지 계산
    const companyTotals = new Map<string, {
      company_name: string;
      representative_name: string;
      total_earned: number;
      total_spent: number;
      user_count: number;
      user_ids: Set<string>;
    }>();

    totalPoints?.forEach((record: any) => {
      const companyName = record.users?.company_name || '미등록 회사';
      const representativeName = record.users?.representative_name || '미등록';
      const userId = record.users?.id;
      const amount = record.amount || 0;
      const type = record.type;

      if (!companyTotals.has(companyName)) {
        companyTotals.set(companyName, {
          company_name: companyName,
          representative_name: representativeName,
          total_earned: 0,
          total_spent: 0,
          user_count: 0,
          user_ids: new Set()
        });
      }

      const company = companyTotals.get(companyName)!;
      
      // 사용자 카운트 (중복 제거)
      if (userId) {
        company.user_ids.add(userId);
      }

      // 마일리지 계산 - 단순하게!
      if (type === 'earn') {
        company.total_earned += amount;
      } else if (type === 'spend') {
        company.total_spent += Math.abs(amount); // spend는 절댓값으로 누적 (양수 표시용)
      }
    });

    // Map을 배열로 변환하고 현재 잔액 계산
    const result = Array.from(companyTotals.values()).map(company => {
      const currentBalance = company.total_earned - company.total_spent;
      
      return {
        company_name: company.company_name,
        representative_name: company.representative_name,
        total_points: currentBalance, // 현재 잔액
        total_earned: company.total_earned,
        total_spent: company.total_spent,
        user_count: company.user_ids.size
      };
    }).sort((a, b) => b.total_points - a.total_points); // 총 포인트 내림차순 정렬

    console.log('API 응답 데이터:', result); // 디버그용 로그

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Total points API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 