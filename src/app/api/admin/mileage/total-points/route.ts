import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 회사별 총 마일리지 계산 쿼리 - 페이지네이션으로 모든 데이터 가져오기
    let totalPoints: any[] = [];
    let page = 0;
    const limit = 1000; // Supabase 기본 limit
    let hasMore = true;

    console.log('🔍 마일리지 데이터 페이지네이션으로 조회 시작...');

    while (hasMore) {
      const { data: pageData, error } = await supabase
        .from('mileage')
        .select(`
          amount,
          type,
          created_at,
          status,
          users!inner(
            id,
            company_name,
            representative_name
          )
        `)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        console.error(`페이지 ${page} 조회 오류:`, error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch total points'
        }, { status: 500 });
      }

      if (pageData && pageData.length > 0) {
        totalPoints = totalPoints.concat(pageData);
        console.log(`🔍 페이지 ${page + 1}: ${pageData.length}건 조회 (총 ${totalPoints.length}건)`);
        page++;
        
        // 1000건 미만이면 마지막 페이지
        if (pageData.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`🔍 전체 마일리지 데이터 조회 완료: ${totalPoints.length}건`);

    console.log(`🔍 전체 마일리지 데이터 수: ${totalPoints?.length || 0}건`);

    // 회사별로 그룹핑하여 총 마일리지 계산
    const companyTotals = new Map<string, {
      company_name: string;
      representative_name: string;
      total_earned: number;
      total_spent: number;
      total_points: number; // 각 사용자의 최종 잔액 합산
      user_count: number;
      user_ids: Set<string>;
      user_balances: Map<string, number>; // 각 사용자별 잔액 추적
    }>();

    // 먼저 각 사용자별로 마일리지 내역을 시간순으로 정렬하여 정확한 잔액 계산
    const userMileageMap = new Map<string, any[]>();
    
    totalPoints?.forEach((record: any) => {
      const userId = record.users?.id;
      if (userId) {
        if (!userMileageMap.has(userId)) {
          userMileageMap.set(userId, []);
        }
        userMileageMap.get(userId)!.push(record);
      }
    });

    console.log(`🔍 사용자별 마일리지 그룹핑 완료: ${userMileageMap.size}명`);

    // 각 사용자별로 시간순 정렬 후 잔액 계산 - /admin/mileage의 calculateCumulativeBalances와 동일한 방식
    userMileageMap.forEach((userRecords, userId) => {
      // 시간순으로 정렬 (오래된 것부터) - /admin/mileage와 동일
      const sortedRecords = userRecords.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      let runningBalance = 0; // /admin/mileage와 동일한 변수명 사용
      
      sortedRecords.forEach(record => {
        // /admin/mileage의 calculateCumulativeBalances와 정확히 동일한 로직
        if (record.status === 'completed') {
          const absoluteAmount = Math.abs(record.amount);
          if (record.type === 'earn') {
            runningBalance += absoluteAmount;
          } else if (record.type === 'spend') {
            runningBalance -= absoluteAmount;
          }
        }
      });

      const companyName = sortedRecords[0]?.users?.company_name || '미등록 회사';
      const representativeName = sortedRecords[0]?.users?.representative_name || '미등록';

      if (!companyTotals.has(companyName)) {
        companyTotals.set(companyName, {
          company_name: companyName,
          representative_name: representativeName,
          total_earned: 0,
          total_spent: 0,
          total_points: 0,
          user_count: 0,
          user_ids: new Set(),
          user_balances: new Map()
        });
      }

      const company = companyTotals.get(companyName)!;
      company.user_ids.add(userId);
      company.user_balances.set(userId, runningBalance);
      
      // 미스터제이슨 회사의 경우 상세 디버깅
      if (companyName.includes('미스터제이슨') || companyName.includes('제이슨')) {
        console.log(`🔍 ${companyName} - 사용자 ${userId} 계산 (total-points):`);
        console.log(`  - 최종 잔액: ${runningBalance.toLocaleString()}원`);
        console.log(`  - 마일리지 내역 수: ${sortedRecords.length}`);
        console.log(`  - 상태: completed만 계산`);
      }
    });

    // 회사별 총합 계산 - /admin/mileage와 동일한 방식으로 계산
    companyTotals.forEach((company, companyName) => {
      let totalEarned = 0;
      let totalSpent = 0;
      let totalBalance = 0; // 각 사용자의 최종 잔액 합산
      
      company.user_balances.forEach((userBalance, userId) => {
        // 각 사용자의 최종 잔액을 합산
        totalBalance += userBalance;
        
        // 각 사용자의 마일리지 내역을 다시 조회하여 정확한 earned/spent 계산
        const userRecords = userMileageMap.get(userId) || [];
        userRecords.forEach(record => {
          const absoluteAmount = Math.abs(record.amount);
          if (record.type === 'earn') {
            totalEarned += absoluteAmount;
          } else if (record.type === 'spend') {
            totalSpent += absoluteAmount;
          }
        });
      });
      
      company.total_earned = totalEarned;
      company.total_spent = totalSpent;
      company.user_count = company.user_ids.size;
      
      // 최종 잔액은 각 사용자의 최종 잔액 합산으로 설정
      company.total_points = totalBalance;
      
      // 미스터제이슨 회사의 경우 상세 디버깅
      if (companyName.includes('미스터제이슨') || companyName.includes('제이슨')) {
        console.log(`🔍 ${companyName} 상세 계산:`);
        console.log(`  - 사용자 수: ${company.user_ids.size}`);
        console.log(`  - 사용자 ID 목록:`, Array.from(company.user_ids));
        company.user_balances.forEach((userBalance, userId) => {
          console.log(`  - 사용자 ${userId} 잔액: ${userBalance.toLocaleString()}원`);
          const userRecords = userMileageMap.get(userId) || [];
          console.log(`  - 사용자 ${userId} 마일리지 내역 수: ${userRecords.length}`);
        });
        console.log(`  - 총 적립: ${totalEarned.toLocaleString()}원`);
        console.log(`  - 총 차감: ${totalSpent.toLocaleString()}원`);
        console.log(`  - 각 사용자 잔액 합산: ${totalBalance.toLocaleString()}원`);
        console.log(`  - earned-spent 계산: ${(totalEarned - totalSpent).toLocaleString()}원`);
      }
    });

    // Map을 배열로 변환하고 현재 잔액 계산
    const result = Array.from(companyTotals.values()).map(company => {
      return {
        company_name: company.company_name,
        representative_name: company.representative_name,
        total_points: company.total_points, // 각 사용자의 최종 잔액 합산
        total_earned: company.total_earned,
        total_spent: company.total_spent,
        user_count: company.user_ids.size
      };
    }).sort((a, b) => b.total_points - a.total_points); // 총 포인트 내림차순 정렬

    // 디버깅을 위한 상세 로그
    console.log('🔍 전체 포인트 계산 결과:');
    result.forEach(company => {
      console.log(`📊 ${company.company_name}:`);
      console.log(`  - 총 적립: ${company.total_earned.toLocaleString()}원`);
      console.log(`  - 총 차감: ${company.total_spent.toLocaleString()}원`);
      console.log(`  - 현재 잔액: ${company.total_points.toLocaleString()}원`);
      console.log(`  - 사용자 수: ${company.user_count}명`);
      
      // 미스터제이슨 회사의 경우 상세 정보 출력
      if (company.company_name.includes('미스터제이슨') || company.company_name.includes('제이슨')) {
        console.log(`🔍 ${company.company_name} 상세 정보:`);
        const companyData = companyTotals.get(company.company_name);
        if (companyData) {
          console.log(`  - 총 적립: ${company.total_earned.toLocaleString()}원`);
          console.log(`  - 총 차감: ${company.total_spent.toLocaleString()}원`);
          console.log(`  - 현재 잔액: ${company.total_points.toLocaleString()}원`);
          console.log(`  - 잔액 상태: ${company.total_points < 0 ? '음수' : '양수'}`);
          companyData.user_balances.forEach((userBalance, userId) => {
            console.log(`  - 사용자 ${userId}: ${userBalance.toLocaleString()}원 (${userBalance < 0 ? '음수' : '양수'})`);
          });
        }
      }
    });
    
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