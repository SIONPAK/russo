import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { getKoreaDate } from '@/shared/lib/utils';

interface CompanySummary {
  businessName: string;
  totalDeduction: number;
  actualSupplyAmount: number;
  estimatedVat: number;
  totalWithVat: number;
  recordCount: number;
  latestDeductionDate: string | null;
  memberInfo: {
    ceoName: string;
    businessNumber: string;
    businessAddress: string;
    tel: string;
    email: string;
    businessType: string;
    businessCategory: string;
  } | null;
  is_issued: string;
  issuedAt: string | null;
  issuedBy: string | null;
}

// 관리자용 업체별 월별 집계 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const yearMonth = searchParams.get('yearMonth') || getKoreaDate().slice(0, 7); // YYYY-MM
    
    console.log(`세금계산서 월별 집계 조회: ${yearMonth}`);

    // 해당 월의 시작일과 종료일 계산
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    
    // 해당 월의 마지막 날까지 전체 조회 (세금계산서는 월단위)
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    
    console.log(`세금계산서 조회 기간: ${startDate} ~ ${endDate}`);

    // 1. 해당 월의 모든 업체 적립 마일리지 조회 (실제 입금받은 금액)
    // 9월 1일부터 9월 30일까지 조회
    const utcStartDate = '2025-09-01T00:00:00';
    const utcEndDate = '2025-09-30T23:59:59';

    console.log(`🔍 [세금계산서] 적립 마일리지 조회 시작 (실제 입금 기준):`, {
      한국시간_시작: startDate + 'T00:00:00+09:00',
      한국시간_종료: endDate + 'T23:59:59+09:00',
      UTC_시작: utcStartDate,
      UTC_종료: utcEndDate,
      yearMonth
    });

    // 베이든 1026300원 데이터가 UTC 범위에 포함되는지 직접 확인
    const baedenDataTime = '2025-07-21T15:15:46.693+00:00';
    console.log(`🔍 [세금계산서] 베이든 1026300원 데이터 시간 체크:`, {
      베이든데이터시간: baedenDataTime,
      UTC시작범위: utcStartDate,
      UTC종료범위: utcEndDate,
      시작범위포함: baedenDataTime >= utcStartDate,
      종료범위포함: baedenDataTime <= utcEndDate,
      전체범위포함: baedenDataTime >= utcStartDate && baedenDataTime <= utcEndDate
    });

    // 베이든의 누락된 데이터를 정확히 같은 조건으로 조회 (적립 기준)
    const { data: baedenTestData, error: baedenTestError } = await supabase
      .from('mileage')
      .select(`
        user_id,
        amount,
        type,
        source,
        description,
        created_at,
        users(
          id,
          company_name,
          representative_name,
          business_number,
          address,
          phone,
          email,
          business_type,
          business_category
        )
      `)
      .eq('user_id', '2483076a-f0e8-4ca0-808a-e8dc1f17b1fb')
      .eq('type', 'earn')
      .gte('created_at', utcStartDate)
      .lt('created_at', utcEndDate)
      .not('users', 'is', null);

    if (!baedenTestError) {
      console.log(`🔍 [세금계산서] 베이든 user_id로 정확한 조건 조회:`, {
        건수: baedenTestData?.length || 0,
        데이터: baedenTestData?.map((d: any) => ({
          user_id: d.user_id,
          금액: d.amount,
          날짜: d.created_at,
          업체명: d.users?.company_name,
          설명: d.description,
          사용자정보: !!d.users
        }))
      });
    }

    // 베이든 사용자 정보 직접 확인
    const { data: baedenUser, error: baedenUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', '2483076a-f0e8-4ca0-808a-e8dc1f17b1fb')
      .single();

    if (!baedenUserError && baedenUser) {
      console.log(`🔍 [세금계산서] 베이든 사용자 정보:`, {
        id: baedenUser.id,
        company_name: baedenUser.company_name,
        is_active: baedenUser.is_active,
        approval_status: baedenUser.approval_status
      });
    } else {
      console.log(`🔍 [세금계산서] 베이든 사용자 조회 오류:`, baedenUserError);
    }

    // 1026300원 데이터를 ID로 직접 조회해서 조인 테스트
    const { data: missingDataWithJoin, error: missingJoinError } = await supabase
      .from('mileage')
      .select(`
        id,
        user_id,
        amount,
        type,
        source,
        description,
        created_at,
        users(
          id,
          company_name,
          representative_name,
          business_number,
          address,
          phone,
          email,
          business_type,
          business_category
        )
      `)
      .eq('id', 'a7962905-1867-4157-a4c5-2ab9344518fc');

    if (!missingJoinError && missingDataWithJoin) {
      console.log(`🔍 [세금계산서] 1026300원 데이터 조인 테스트:`, {
        건수: missingDataWithJoin.length,
        데이터: missingDataWithJoin.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          금액: d.amount,
          날짜: d.created_at,
          업체명: d.users?.company_name,
          사용자조인성공: !!d.users,
          사용자상세: d.users
        }))
      });
    } else {
      console.log(`🔍 [세금계산서] 1026300원 조인 오류:`, missingJoinError);
    }

    // 전체 쿼리 다시 실행해서 총 건수 확인
    const { data: allDeductionCheck, error: allDeductionError } = await supabase
      .from('mileage')
      .select('id, amount, description, created_at, user_id')
      .eq('type', 'spend')
      .gte('created_at', utcStartDate)
      .lt('created_at', utcEndDate);

    if (!allDeductionError) {
      console.log(`🔍 [세금계산서] 조인 없는 전체 데이터:`, {
        총건수: allDeductionCheck?.length || 0,
        베이든데이터: allDeductionCheck?.filter(d => d.user_id === '2483076a-f0e8-4ca0-808a-e8dc1f17b1fb').map(d => ({
          id: d.id,
          금액: d.amount,
          설명: d.description,
          날짜: d.created_at
        }))
      });
    }

    // 간단하게 마일리지 테이블에서 earn만 조회 (데이터 가공 없이)
    console.log(`🔍 [세금계산서] 마일리지 earn 데이터 조회 시작`);

    const { data: allEarningData, error: earningError } = await supabase
      .from('mileage')
      .select(`
        user_id,
        amount,
        type,
        source,
        description,
        created_at,
        users(
          id,
          company_name,
          representative_name,
          business_number,
          address,
          phone,
          email,
          business_type,
          business_category
        )
      `)
      .eq('type', 'earn')
      .gte('created_at', utcStartDate)
      .lte('created_at', utcEndDate)
      .not('users', 'is', null);

    if (earningError) {
      console.error('마일리지 적립 데이터 조회 오류:', earningError);
      return NextResponse.json(
        { success: false, error: '마일리지 적립 데이터 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log(`🔍 [세금계산서] 마일리지 earn 데이터 조회 완료: ${allEarningData?.length || 0}건`);

    const earningData = allEarningData;

    console.log(`🔍 [세금계산서] 마일리지 적립 데이터 조회 완료 (실제 입금 기준):`, {
      총건수: earningData?.length || 0,
      총입금액: earningData?.reduce((sum, d) => sum + Math.abs(d.amount), 0) || 0,
      샘플: earningData?.slice(0, 3).map((d: any) => ({
        업체명: d.users?.company_name,
        금액: d.amount,
        타입: d.type,
        소스: d.source,
        설명: d.description,
        날짜: d.created_at
      }))
    });

    // 디버깅용: 전체 earn 타입 데이터 개수 확인
    const { count: totalEarnCount } = await supabase
      .from('mileage')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'earn');

    console.log(`🔍 [세금계산서] 전체 earn 타입 마일리지 개수 (실제 입금): ${totalEarnCount || 0}건`);

    // 마메드로 데이터 디버깅
    const mamedroData = earningData?.filter((d: any) => 
      d.users?.company_name?.includes('마메드로') || 
      d.users?.company_name?.includes('mamedro')
    ) || [];
    
    console.log(`🔍 [세금계산서] 마메드로 데이터 디버깅:`, {
      건수: mamedroData.length,
      총액: mamedroData.reduce((sum, d) => sum + Math.abs(d.amount), 0),
      상세: mamedroData.map((d: any) => ({
        금액: d.amount,
        날짜: d.created_at,
        설명: d.description
      }))
    });

    // 9월 30일 데이터 특별 확인
    const sept30Data = mamedroData.filter((d: any) => 
      d.created_at?.startsWith('2025-09-30')
    );
    console.log(`🔍 [세금계산서] 9월 30일 데이터:`, {
      건수: sept30Data.length,
      총액: sept30Data.reduce((sum, d) => sum + Math.abs(d.amount), 0),
      상세: sept30Data.map((d: any) => ({
        금액: d.amount,
        날짜: d.created_at,
        설명: d.description
      }))
    });

    // 2. 세금계산서 발행 상태 조회
    const { data: taxInvoiceStatus, error: statusError } = await supabase
      .from('tax_invoice_status')
      .select('*')
      .eq('year_month', yearMonth);

    if (statusError) {
      console.error('세금계산서 상태 조회 오류:', statusError);
      // 상태 조회 실패는 무시하고 계속 진행
    }

    // 3. 업체별 데이터 집계 (적립 기준)
    const companySummaries = new Map<string, {
      totalEarning: number;
      recordCount: number;
      latestEarningDate: string | null;
      memberInfo: any;
      is_issued: string;
      issuedAt: string | null;
      issuedBy: string | null;
    }>();

    console.log(`🔍 [세금계산서] 업체별 집계 시작: ${earningData?.length || 0}건 처리 (실제 입금 기준)`);

    // 베이든 데이터 필터링 확인
    const baedenDataInQuery = earningData?.filter((record: any) => 
      (record.users as any)?.company_name === '베이든'
    );
    console.log(`🔍 [세금계산서] 쿼리 결과에서 베이든 데이터 (적립 기준):`, {
      건수: baedenDataInQuery?.length || 0,
      데이터: baedenDataInQuery?.map((d: any) => ({
        금액: d.amount,
        설명: d.description,
        날짜: d.created_at,
        소스: d.source
      }))
    });

    earningData?.forEach((record: any, index: number) => {
      const user = record.users as any;
      const businessName = user?.company_name;
      const amount = Math.abs(record.amount);
      
      if (index < 5 || businessName === '베이든') {
        console.log(`🔍 [세금계산서] 처리중 ${index + 1}번째 ${businessName === '베이든' ? '(베이든!)' : ''}:`, {
          업체명: businessName,
          금액: amount,
          사용자정보: !!user,
          원본금액: record.amount,
          타입: record.type,
          소스: record.source,
          설명: record.description
        });
      }

      if (!businessName) {
        console.warn(`🚨 [세금계산서] 업체명 없음:`, record);
        return;
      }
      
      const summary = companySummaries.get(businessName) || {
        totalEarning: 0,
        recordCount: 0,
        latestEarningDate: null,
        memberInfo: {
          ceoName: user?.representative_name,
          businessNumber: user?.business_number,
          businessAddress: user?.address,
          tel: user?.phone,
          email: user?.email,
          businessType: user?.business_type,
          businessCategory: user?.business_category
        },
        is_issued: 'X',
        issuedAt: null,
        issuedBy: null
      };

      summary.totalEarning += amount;
      summary.recordCount += 1;
      
      // 최신 적립일 업데이트
      if (!summary.latestEarningDate || record.created_at > summary.latestEarningDate) {
        summary.latestEarningDate = record.created_at;
      }

      companySummaries.set(businessName, summary);
    });

    console.log(`🔍 [세금계산서] 업체별 집계 완료 (적립 기준):`, {
      총업체수: companySummaries.size,
      업체목록: Array.from(companySummaries.keys()).slice(0, 5),
      샘플집계: Array.from(companySummaries.entries()).slice(0, 3).map(([name, summary]) => ({
        업체명: name,
        총적립액: summary.totalEarning,
        건수: summary.recordCount
      }))
    });

    // 베이든 데이터 특별 확인
    const baedenSummary = companySummaries.get('베이든');
    if (baedenSummary) {
      console.log(`🔍 [세금계산서] 베이든 집계 결과 (적립 기준):`, {
        업체명: '베이든',
        총적립액: baedenSummary.totalEarning,
        건수: baedenSummary.recordCount,
        최근적립일: baedenSummary.latestEarningDate
      });
    }

    // 베이든의 전체 마일리지 데이터 확인 (날짜 무관, 적립 기준)
    const { data: baedenAllData, error: baedenError } = await supabase
      .from('mileage')
      .select(`
        user_id,
        amount,
        type,
        source,
        description,
        created_at,
        users!inner(company_name)
      `)
      .eq('type', 'earn')
      .eq('users.company_name', '베이든')
      .order('created_at', { ascending: false });

    if (!baedenError && baedenAllData) {
      console.log(`🔍 [세금계산서] 베이든 전체 earn 데이터 (적립 기준):`, {
        총건수: baedenAllData.length,
        전체목록: baedenAllData.map((d: any) => ({
          금액: d.amount,
          설명: d.description,
          날짜: d.created_at,
          소스: d.source,
          해당월포함: d.created_at >= utcStartDate && d.created_at < utcEndDate
        }))
      });
    }

    // 4. 세금계산서 발행 상태 적용
    taxInvoiceStatus?.forEach((status: any) => {
      const summary = companySummaries.get(status.company_name as string);
      if (summary) {
        summary.is_issued = status.status;
        summary.issuedAt = status.issued_at;
        summary.issuedBy = status.issued_by;
      }
    });

    // 5. 결과 데이터 구성 (적립 기준)
    const results: CompanySummary[] = Array.from(companySummaries.entries()).map(([businessName, summary]) => {
      // 적립 마일리지 = 부가세 포함 금액 (1.0)
      const totalWithVat = summary.totalEarning;
      
      // 공급가액 계산 (부가세 포함 금액 / 1.1)
      const actualSupplyAmount = Math.round(totalWithVat / 1.1);
      
      // 부가세 계산 (부가세 포함 금액 - 공급가액)
      const estimatedVat = totalWithVat - actualSupplyAmount;

      return {
        businessName,
        totalDeduction: summary.totalEarning, // 기존 인터페이스 호환성을 위해 유지
        actualSupplyAmount,
        estimatedVat,
        totalWithVat,
        recordCount: summary.recordCount,
        latestDeductionDate: summary.latestEarningDate, // 원본 데이터 그대로
        memberInfo: summary.memberInfo,
        is_issued: summary.is_issued,
        issuedAt: summary.issuedAt,
        issuedBy: summary.issuedBy
      };
    });

    // 6. 총계 계산
    const grandTotal = results.reduce((acc, item) => ({
      totalDeduction: acc.totalDeduction + item.totalDeduction,
      actualSupplyAmount: acc.actualSupplyAmount + item.actualSupplyAmount,
      estimatedVat: acc.estimatedVat + item.estimatedVat,
      totalWithVat: acc.totalWithVat + item.totalWithVat
    }), {
      totalDeduction: 0,
      actualSupplyAmount: 0,
      estimatedVat: 0,
      totalWithVat: 0
    });

    // 7. 업체명 기준 정렬
    results.sort((a, b) => a.businessName.localeCompare(b.businessName));

    const responseData = {
      yearMonth,
      period: {
        startDate,
        endDate
      },
      results,
      summary: {
        totalCompanies: results.length,
        grandTotal
      }
    };

    console.log(`세금계산서 집계 완료 (적립 기준): ${results.length}개 업체, 총 적립액: ${grandTotal.totalDeduction.toLocaleString()}원`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('세금계산서 관리 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 관리 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 