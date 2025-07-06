import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

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
    
    const yearMonth = searchParams.get('yearMonth') || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    console.log(`세금계산서 월별 집계 조회: ${yearMonth}`);

    // 해당 월의 시작일과 종료일 계산
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    
    // 해당 월의 마지막 날 계산
    const today = new Date();
    const isCurrentMonth = (year === today.getFullYear()) && (month === (today.getMonth() + 1));
    
    let endDate;
    if (isCurrentMonth) {
      // 현재 월이면 한국시간 기준 오늘 날짜까지
      const koreanTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
      endDate = koreanTime.toISOString().split('T')[0];
    } else {
      // 과거/미래 월이면 해당 월의 마지막 날까지
      endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    }
    
    console.log(`세금계산서 조회 기간: ${startDate} ~ ${endDate}`);

    // 1. 해당 월의 모든 업체 차감 마일리지 조회
    const { data: deductionData, error: deductionError } = await supabase
      .from('mileage')
      .select(`
        user_id,
        amount,
        created_at,
        users!inner(
          id,
          company_name,
          representative_name,
          business_number,
          address,
          phone,
          email
        )
      `)
      .eq('type', 'spend')
      .eq('source', 'order')
      .gte('created_at', startDate + 'T00:00:00+09:00')
      .lte('created_at', endDate + 'T23:59:59+09:00');

    if (deductionError) {
      console.error('차감 마일리지 조회 오류:', deductionError);
      return NextResponse.json(
        { success: false, error: '차감 마일리지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    console.log(`마일리지 차감 데이터 조회 완료: ${deductionData?.length || 0}건`);

    // 2. 세금계산서 발행 상태 조회
    const { data: taxInvoiceStatus, error: statusError } = await supabase
      .from('tax_invoice_status')
      .select('*')
      .eq('year_month', yearMonth);

    if (statusError) {
      console.error('세금계산서 상태 조회 오류:', statusError);
      // 상태 조회 실패는 무시하고 계속 진행
    }

    // 3. 업체별 데이터 집계
    const companySummaries = new Map<string, {
      totalDeduction: number;
      recordCount: number;
      latestDeductionDate: string | null;
      memberInfo: any;
      is_issued: string;
      issuedAt: string | null;
      issuedBy: string | null;
    }>();

    deductionData?.forEach((record: any) => {
      const user = record.users as any;
      const businessName = user.company_name;
      const amount = Math.abs(record.amount);
      
      const summary = companySummaries.get(businessName) || {
        totalDeduction: 0,
        recordCount: 0,
        latestDeductionDate: null,
        memberInfo: {
          ceoName: user.representative_name,
          businessNumber: user.business_number,
          businessAddress: user.address,
          tel: user.phone,
          email: user.email
        },
        is_issued: 'X',
        issuedAt: null,
        issuedBy: null
      };

      summary.totalDeduction += amount;
      summary.recordCount += 1;
      
      // 최신 차감일 업데이트
      if (!summary.latestDeductionDate || record.created_at > summary.latestDeductionDate) {
        summary.latestDeductionDate = record.created_at;
      }

      companySummaries.set(businessName, summary);
    });

    // 4. 세금계산서 발행 상태 적용
    taxInvoiceStatus?.forEach((status: any) => {
      const summary = companySummaries.get(status.company_name);
      if (summary) {
        summary.is_issued = status.status;
        summary.issuedAt = status.issued_at;
        summary.issuedBy = status.issued_by;
      }
    });

    // 5. 결과 데이터 구성
    const results: CompanySummary[] = Array.from(companySummaries.entries()).map(([businessName, summary]) => {
      // 공급가액 계산 (차감 마일리지 / 1.1)
      const actualSupplyAmount = Math.round(summary.totalDeduction / 1.1);
      // 부가세 계산 (공급가액 * 0.1)
      const estimatedVat = Math.round(actualSupplyAmount * 0.1);
      // 부가세 포함 금액
      const totalWithVat = actualSupplyAmount + estimatedVat;

      return {
        businessName,
        totalDeduction: summary.totalDeduction,
        actualSupplyAmount,
        estimatedVat,
        totalWithVat,
        recordCount: summary.recordCount,
        latestDeductionDate: summary.latestDeductionDate,
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

    console.log(`세금계산서 집계 완료: ${results.length}개 업체, 총 차감액: ${grandTotal.totalDeduction.toLocaleString()}원`);

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