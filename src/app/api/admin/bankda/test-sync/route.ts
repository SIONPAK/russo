import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

// POST - 뱅크다 동기화 테스트 (06-01 ~ 오늘)
export async function POST(request: NextRequest) {
  try {
    console.log(`[${new Date().toISOString()}] 뱅크다 동기화 테스트 시작`);
    
    const body = await request.json();
    const { startDate, endDate } = body;
    
    // 기본값: 06-01부터 오늘까지
    const today = new Date();
    const koreanTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    
    const defaultStartDate = '2024-06-01';
    const defaultEndDate = koreanTime.toISOString().split('T')[0];
    
    const datefrom = startDate || defaultStartDate;
    const dateto = endDate || defaultEndDate;
    
    console.log(`뱅크다 동기화 테스트 날짜 범위: ${datefrom} ~ ${dateto}`);
    
    const result = await performBankdaTestSync(datefrom, dateto);
    
    return NextResponse.json({
      success: true,
      message: `뱅크다 동기화 테스트가 완료되었습니다.`,
      syncTime: new Date().toISOString(),
      dateRange: { from: datefrom, to: dateto },
      processed: result.processed,
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      details: result.details || []
    });
    
  } catch (error) {
    console.error('뱅크다 동기화 테스트 중 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '뱅크다 동기화 테스트 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        syncTime: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// 뱅크다 동기화 테스트 함수
async function performBankdaTestSync(datefrom: string, dateto: string) {
  const axios = require('axios');
  const FormData = require('form-data');
  
  const BANKDA_API_URL = 'https://a.bankda.com/dtsvc/bank_tr.php';
  const BANKDA_ACCESS_TOKEN = '9d92ac153d211e16fa5baf1d3711b772';
  
  // 날짜 형식 변환 (YYYY-MM-DD → YYYYMMDD)
  const formatDateForBankda = (dateStr: string): string => {
    return dateStr.replace(/-/g, '');
  };
  
  const bankdaDateFrom = formatDateForBankda(datefrom);
  const bankdaDateTo = formatDateForBankda(dateto);
  
  try {
    console.log(`뱅크다 API 호출: ${bankdaDateFrom} ~ ${bankdaDateTo}`);
    
    // 1. 뱅크다 API 호출
    let data = new FormData();
    data.append('datefrom', bankdaDateFrom);
    data.append('dateto', bankdaDateTo);
    data.append('accountnum', '73570101425792');
    data.append('datatype', 'json');
    data.append('charset', 'utf8');
    data.append('istest', 'n'); // 실제 데이터 조회

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: BANKDA_API_URL,
      headers: { 
        'Authorization': `Bearer ${BANKDA_ACCESS_TOKEN}`, 
        ...data.getHeaders()
      },
      data : data
    };

    const bankdaResponse = await axios.request(config);
    
    console.log('뱅크다 API 응답 상태:', bankdaResponse.status);
    
    if (!bankdaResponse.data || !bankdaResponse.data.response) {
      throw new Error('뱅크다 API 응답이 올바르지 않습니다.');
    }
    
    const response = bankdaResponse.data.response;
    const bankData = response.bank || [];
    console.log(`뱅크다에서 ${bankData.length}건의 거래 조회됨`);
    
    if (bankData.length === 0) {
      return {
        message: '조회된 거래가 없습니다.',
        processed: 0,
        total: 0,
        successful: 0,
        failed: 0,
        details: []
      };
    }
    
    // 2. Supabase 클라이언트 생성
    const supabase = await createClient();
    
    // 3. 입금 거래만 필터링
    const deposits = bankData.filter((transaction: any) => 
      parseInt(transaction.bkinput) > 0 && parseInt(transaction.bkoutput) === 0
    );
    
    console.log(`입금 거래: ${deposits.length}건`);
    
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const details: any[] = [];
    
    // 4. 각 입금 거래 처리
    for (const transaction of deposits) {
      try {
        processedCount++;
        
        const extractedNames = extractCompanyName(transaction.bkjukyo);
        const matchedUser = await findMatchingUser(supabase, extractedNames);
        
        const transactionDetail: any = {
          date: transaction.bkdate,
          time: transaction.bktime,
          amount: parseInt(transaction.bkinput),
          depositor: transaction.bkjukyo,
          extractedNames,
          matchedUser: matchedUser?.company_name || null,
          status: 'pending'
        };
        
        if (!matchedUser) {
          console.log(`매칭 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')}`);
          transactionDetail.status = 'failed';
          transactionDetail.error = '매칭되는 사용자를 찾을 수 없음';
          details.push(transactionDetail);
          failedCount++;
          
          // 실패 로그 기록
          await supabase
            .from('mileage_logs')
            .insert({
              user_id: null,
              type: 'bankda_sync_failed',
              amount: parseInt(transaction.bkinput),
              reason: 'user_not_found',
              description: `뱅크다 동기화 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')} (${transaction.bkdate} ${transaction.bktime})`
            });
          
          continue;
        }
        
        // 중복 체크 (같은 날짜, 시간, 금액, 사용자)
        const { data: existingRecord } = await supabase
          .from('mileage')
          .select('id')
          .eq('user_id', matchedUser.id)
          .eq('amount', parseInt(transaction.bkinput))
          .eq('source', 'bankda')
          .ilike('description', `%${transaction.bkdate}%${transaction.bktime}%`)
          .single();
        
        if (existingRecord) {
          console.log(`중복 거래 건너뛰기: ${matchedUser.company_name} ${parseInt(transaction.bkinput)}원`);
          transactionDetail.status = 'duplicate';
          transactionDetail.error = '이미 처리된 거래';
          details.push(transactionDetail);
          continue;
        }
        
        // 마일리지 적립
        const { data: mileage, error } = await supabase
          .from('mileage')
          .insert({
            user_id: matchedUser.id,
            amount: parseInt(transaction.bkinput),
            type: 'earn',
            source: 'bankda',
            description: `뱅크다 자동적립: ${transaction.bkjukyo} (${transaction.bkdate} ${transaction.bktime})`,
            status: 'completed'
          })
          .select()
          .single();
        
        if (error) {
          console.error(`마일리지 적립 실패 (${matchedUser.company_name}):`, error);
          transactionDetail.status = 'error';
          transactionDetail.error = error.message;
          details.push(transactionDetail);
          failedCount++;
          
          // 실패 로그 기록
          await supabase
            .from('mileage_logs')
            .insert({
              user_id: matchedUser.id,
              type: 'bankda_sync_failed',
              amount: parseInt(transaction.bkinput),
              reason: 'database_error',
              description: `뱅크다 동기화 DB 오류: ${error.message} (${transaction.bkdate} ${transaction.bktime})`
            });
        } else {
          successCount++;
          transactionDetail.status = 'success';
          transactionDetail.mileageId = mileage.id;
          details.push(transactionDetail);
          console.log(`✅ 마일리지 적립 성공: ${matchedUser.company_name} (+${parseInt(transaction.bkinput)}원)`);
          
          // 성공 로그 기록
          await supabase
            .from('mileage_logs')
            .insert({
              user_id: matchedUser.id,
              type: 'bankda_sync_success',
              amount: parseInt(transaction.bkinput),
              reason: 'auto_earn',
              reference_id: mileage.id,
              reference_type: 'mileage',
              description: `뱅크다 자동적립 성공: ${transaction.bkjukyo} (${transaction.bkdate} ${transaction.bktime})`
            });
        }
        
      } catch (error) {
        console.error(`거래 처리 중 오류:`, error);
        failedCount++;
        details.push({
          date: transaction.bkdate,
          time: transaction.bktime,
          amount: parseInt(transaction.bkinput),
          depositor: transaction.bkjukyo,
          extractedNames: extractCompanyName(transaction.bkjukyo),
          matchedUser: null,
          status: 'error',
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    return {
      message: `처리 완료: ${successCount}건 성공, ${failedCount}건 실패`,
      processed: processedCount,
      total: deposits.length,
      successful: successCount,
      failed: failedCount,
      details
    };
    
  } catch (error) {
    console.error('뱅크다 동기화 오류:', error);
    throw error;
  }
}

// 입금자명에서 회사명 추출 함수
function extractCompanyName(bkjukyo: string): string[] {
  if (!bkjukyo) return [];
  
  const candidates: string[] = [];
  
  // 1. 전체 텍스트 추가
  candidates.push(bkjukyo.trim());
  
  // 2. 괄호 패턴 추출
  const allParentheses = bkjukyo.match(/\([^)]*\)/g) || [];
  for (const match of allParentheses) {
    const content = match.replace(/[()]/g, '').trim();
    if (content && content.length > 0) {
      candidates.push(content);
    }
  }
  
  // 3. 괄호 제거한 앞부분
  if (bkjukyo.includes('(')) {
    const beforeParentheses = bkjukyo.substring(0, bkjukyo.indexOf('(')).trim();
    if (beforeParentheses && beforeParentheses.length > 0) {
      candidates.push(beforeParentheses);
    }
  }
  
  // 4. 공백으로 분리된 단어들
  const words = bkjukyo.split(/[\s(),]+/).filter(word => 
    word.length >= 2 && 
    !/^\d+$/.test(word) && 
    !['원', '님', '씨', '대표', '사장', '회사', '입금'].includes(word)
  );
  candidates.push(...words);
  
  // 중복 제거
  const uniqueCandidates = Array.from(new Set(candidates))
    .filter(candidate => candidate && candidate.length >= 2)
    .map(candidate => candidate.trim());
  
  console.log(`입금자명 "${bkjukyo}" → 추출된 후보: [${uniqueCandidates.join(', ')}]`);
  
  return uniqueCandidates;
}

// 사용자 매칭 함수
async function findMatchingUser(supabase: any, extractedNames: string[]): Promise<any | null> {
  if (!extractedNames || extractedNames.length === 0) return null;
  
  try {
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, company_name, representative_name')
      .not('company_name', 'is', null)
      .neq('company_name', '');
    
    if (!allUsers || allUsers.length === 0) return null;
    
    // 정확한 매칭 시도
    for (const extractedName of extractedNames) {
      const exactMatch = allUsers.find((user: any) => {
        return user.company_name === extractedName || 
               user.representative_name === extractedName;
      });

      if (exactMatch) {
        console.log(`✅ 정확한 매칭 성공: "${extractedName}" → "${exactMatch.company_name}"`);
        return exactMatch;
      }
    }

    // 부분 매칭 시도
    for (const extractedName of extractedNames) {
      const partialMatch = allUsers.find((user: any) => {
        return user.company_name?.includes(extractedName) || 
               extractedName.includes(user.company_name);
      });

      if (partialMatch) {
        console.log(`✅ 부분 매칭 성공: "${extractedName}" → "${partialMatch.company_name}"`);
        return partialMatch;
      }
    }

    return null;
  } catch (error) {
    console.error("사용자 매칭 중 오류:", error);
    return null;
  }
} 