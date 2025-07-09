import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { logMileageFailure, MILEAGE_FAILURE_REASONS } from '@/shared/utils/mileage-failure-logger';
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils';
const axios = require('axios');
const FormData = require('form-data');

// Vercel Cron Job용 GET 엔드포인트 - 5분마다 자동 실행
export async function GET(request: NextRequest) {
  try {
    console.log(`[${getKoreaTime()}] 뱅크다 자동 동기화 크론 실행`);
    
    // 1. 먼저 활성화 상태 확인
    const isEnabled = await checkBankdaAutoSyncStatus();
    
    if (!isEnabled) {
      console.log(`[${getKoreaTime()}] 뱅크다 자동 동기화가 비활성화되어 있습니다. 실행하지 않습니다.`);
      return NextResponse.json({
        success: true,
        message: `뱅크다 자동 동기화가 비활성화되어 있습니다.`,
        cronTime: getKoreaTime(),
        enabled: false
      });
    }
    
    // 2. 활성화되어 있으면 뱅크다 동기화 실행
    console.log(`[${getKoreaTime()}] 뱅크다 자동 동기화 시작 (활성화됨)`);
    const result = await performBankdaSync();
    
    console.log(`[${getKoreaTime()}] 뱅크다 자동 동기화 완료: ${result.message}`);
    
    return NextResponse.json({
      success: true,
      message: `자동 뱅크다 동기화가 완료되었습니다.`,
      cronTime: getKoreaTime(),
      enabled: true,
      processed: result.processed,
      total: result.total
    });
    
  } catch (error) {
    console.error('자동 뱅크다 동기화 중 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '자동 뱅크다 동기화 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        cronTime: getKoreaTime()
      },
      { status: 500 }
    );
  }
}

// 뱅크다 자동 동기화 활성화 상태 확인
async function checkBankdaAutoSyncStatus(): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    // lusso_system_settings 테이블에서 뱅크다 자동 동기화 설정 확인
    const { data: setting } = await supabase
      .from('lusso_system_settings')
      .select('value')
      .eq('key', 'bankda_auto_sync_enabled')
      .single();
    
    // 설정이 없으면 기본값 false
    if (!setting) {
      console.log('뱅크다 자동 동기화 설정이 없습니다. 기본값(false) 사용');
      return false;
    }
    
    const isEnabled = setting.value === 'true' || setting.value === true;
    console.log(`뱅크다 자동 동기화 설정: ${isEnabled ? '활성화' : '비활성화'}`);
    
    return isEnabled;
  } catch (error) {
    console.error('뱅크다 자동 동기화 설정 확인 중 오류:', error);
    // 오류시 안전을 위해 false 반환
    return false;
  }
}

// 뱅크다 동기화 로직 (내부 함수)
async function performBankdaSync() {
  const axios = require('axios');
  const FormData = require('form-data');
  
  const BANKDA_API_URL = 'https://a.bankda.com/dtsvc/bank_tr.php';
  const BANKDA_ACCESS_TOKEN = '9d92ac153d211e16fa5baf1d3711b772';
  
  // 한국 시간대(UTC+9)로 날짜 계산
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const currentHour = koreanTime.getHours();
  
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  };
  
  let datefrom: string;
  let dateto: string;
  
  // 새벽 1시까지는 전일+당일 데이터 조회, 2시부터는 당일만 조회
  if (currentHour >= 0 && currentHour <= 1) {
    // 00:00 ~ 01:59: 어제와 오늘 데이터 모두 조회
    const yesterday = new Date(koreanTime.getTime() - (24 * 60 * 60 * 1000));
    datefrom = formatDate(yesterday); // 어제
    dateto = formatDate(koreanTime);   // 오늘
    console.log(`뱅크다 조회 기간: ${datefrom} ~ ${dateto} (새벽 시간대: 전일+당일 데이터 조회)`);
  } else {
    // 02:00 ~ 23:59: 오늘 데이터만 조회
    datefrom = formatDate(koreanTime); // 오늘
    dateto = formatDate(koreanTime);   // 오늘 (하루치만)
    console.log(`뱅크다 조회 기간: ${datefrom} (일반 시간대: 당일 데이터만 조회)`);
  }
  
  try {
    // 1. 뱅크다 API 호출 (수동 동기화와 동일한 방식)
    let data = new FormData();
    data.append('datefrom', datefrom);
    data.append('dateto', dateto);
    data.append('accountnum', '57370104214209');
    data.append('datatype', 'json');
    data.append('charset', 'utf8');
    data.append('istest', 'n'); // 실제 데이터 조회

    // 공식 예제와 정확히 동일한 config
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

    // axios 요청 실행
    const bankdaResponse = await axios.request(config);
    
    console.log('뱅크다 API 응답 상태:', bankdaResponse.status);
    console.log('뱅크다 API 응답 전체:', JSON.stringify(bankdaResponse.data, null, 2));
    
    if (!bankdaResponse.data || !bankdaResponse.data.response) {
      throw new Error('뱅크다 API 응답이 올바르지 않습니다.');
    }
    
    const response = bankdaResponse.data.response;
    console.log('뱅크다 응답 record:', response.record);
    console.log('뱅크다 응답 description:', response.description);
    
    const bankData = response.bank || [];
    console.log(`뱅크다에서 ${bankData.length}건의 거래 조회됨`);
    
    // 거래 데이터가 있으면 첫 번째 거래 샘플 로그
    if (bankData.length > 0) {
      console.log('첫 번째 거래 샘플:', JSON.stringify(bankData[0], null, 2));
    }
    
    if (bankData.length === 0) {
      return {
        message: '조회된 거래가 없습니다.',
        processed: 0,
        total: 0
      };
    }
    
    // 2. Supabase 클라이언트 생성
    const supabase = await createClient();
    
    // 3. 입금 거래만 필터링 (문자열을 숫자로 변환해서 비교)
    const deposits = bankData.filter((transaction: any) => 
      parseInt(transaction.bkinput) > 0 && parseInt(transaction.bkoutput) === 0
    );
    
    console.log(`입금 거래: ${deposits.length}건`);
    
    // 입금 거래 샘플 로그
    if (deposits.length > 0) {
      console.log('첫 번째 입금 거래:', JSON.stringify(deposits[0], null, 2));
    }
    
    let processedCount = 0;
    let successCount = 0;
    
    // 4. 각 입금 거래 처리
    for (const transaction of deposits) {
      try {
        processedCount++;
        
        // 세액 거래도 포함하여 모든 거래 처리
        // 회사명 추출 및 매칭
        const extractedNames = extractCompanyName(transaction.bkjukyo);
        const matchedCompany = await findMatchingCompany(supabase, extractedNames);
        
        if (!matchedCompany) {
          console.log(`매칭 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')}`);
          
          // 매칭 실패 로그 기록 (수정된 함수 사용)
          await logMileageFailure({
            business_name: transaction.bkjukyo || "알 수 없음",
            attempted_amount: parseInt(transaction.bkinput) || 0,
            reason: MILEAGE_FAILURE_REASONS.MEMBER_NOT_FOUND,
            error_details: `뱅크다 자동 매칭 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')}`,
            settlement_type: "bankda_auto_cron",
            settlement_date: transaction.bkdate || getKoreaDate(),
            original_data: transaction,
          });
          
          continue;
        }
        
        // 강화된 중복 체크 (뱅크다 거래코드, 날짜, 시간, 금액 모두 확인)
        const { data: existingRecord } = await supabase
          .from('mileage')
          .select('id')
          .ilike('description', `%[${transaction.bkcode}]%`)
          .in('source', ['bankda_auto', 'bankda_manual'])
          .single();
        
        if (existingRecord) {
          console.log(`🚫 중복 거래 건너뛰기: [${transaction.bkcode}] ${matchedCompany}, ${parseInt(transaction.bkinput)}원`);
          continue;
        }

        // 추가 중복 체크: 동일한 날짜, 시간, 금액, 업체명으로 이미 처리된 건이 있는지 확인
        const { data: duplicateCheck } = await supabase
          .from('mileage')
          .select('id')
          .eq('amount', parseInt(transaction.bkinput))
          .ilike('description', `%${transaction.bkjukyo}%`)
          .ilike('description', `%${transaction.bkdate}%`)
          .ilike('description', `%${transaction.bktime}%`)
          .in('source', ['bankda_auto', 'bankda_manual'])
          .single();
        
        if (duplicateCheck) {
          console.log(`🚫 중복 거래 건너뛰기 (날짜/시간/금액 일치): ${transaction.bkdate} ${transaction.bktime} - ${matchedCompany}, ${parseInt(transaction.bkinput)}원`);
          continue;
        }
        
        // 사용자 ID 조회 (회사명으로 사용자 찾기)
        const { data: userRecord } = await supabase
          .from('users')
          .select('id, mileage_balance')
          .eq('company_name', matchedCompany)
          .single();
        
        if (!userRecord) {
          console.log(`사용자를 찾을 수 없음: ${matchedCompany}`);
          continue;
        }
        
        // 마일리지 등록 (수동 동기화와 동일한 방식)
        const now = new Date();
        const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const currentTime = koreanTime.toISOString();
        
        const insertData = {
          user_id: userRecord.id,
          amount: parseInt(transaction.bkinput),
          type: 'earn', // 적립
          source: 'bankda_auto',
          description: `자동적립: ${transaction.bkjukyo} (${transaction.bkdate} ${transaction.bktime}) [${transaction.bkcode}]`,
          status: 'completed',
          created_at: currentTime,
          updated_at: currentTime
        };
        
        const { error } = await supabase
          .from('mileage')
          .insert(insertData);
        
        if (error) {
          console.error(`마일리지 등록 실패 (${matchedCompany}):`, error);
          
          // 실패 로그 기록
          await logMileageFailure({
            business_name: matchedCompany,
            attempted_amount: parseInt(transaction.bkinput),
            reason: MILEAGE_FAILURE_REASONS.API_ERROR,
            error_details: `자동 뱅크다 등록 실패: ${error.message}`,
            settlement_type: "bankda_auto_cron",
            settlement_date: transaction.bkdate || getKoreaDate(),
            original_data: { transaction, error: error.message },
          });
        } else {
          // 사용자 마일리지 잔액 업데이트
          const newBalance = (userRecord.mileage_balance || 0) + parseInt(transaction.bkinput);
          await supabase
            .from('users')
            .update({ mileage_balance: newBalance })
            .eq('id', userRecord.id);
          
          successCount++;
          console.log(`✅ 마일리지 등록 성공: ${matchedCompany} (+${parseInt(transaction.bkinput)})`);
        }
        
      } catch (error) {
        console.error(`거래 처리 중 오류:`, error);
        
        // 거래 처리 오류 로그 기록 (수정된 함수 사용)
        await logMileageFailure({
          business_name: transaction.bkjukyo || "알 수 없음",
          attempted_amount: parseInt(transaction.bkinput) || 0,
          reason: MILEAGE_FAILURE_REASONS.UNKNOWN_ERROR,
          error_details: `뱅크다 자동 처리 오류: ${error instanceof Error ? error.message : String(error)} (${transaction.bkjukyo})`,
          settlement_type: "bankda_auto_cron",
          settlement_date: transaction.bkdate || getKoreaDate(),
          original_data: transaction,
        });
      }
    }
    
    return {
      message: `처리 완료: ${successCount}/${processedCount}건 성공`,
      processed: successCount,
      total: processedCount
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
  
  // 2. 모든 괄호 패턴 추출: ()와 () 안의 내용들
  const allParentheses = bkjukyo.match(/\([^)]*\)/g) || [];
  for (const match of allParentheses) {
    const content = match.replace(/[()]/g, '').trim();
    if (content && content.length > 0) {
      candidates.push(content);
      
      // 중첩된 괄호나 특수문자로 구분된 부분들도 추출
      // 예: "에프원(F1" → ["에프원", "F1"]
      const subParts = content.split(/[(),\s]+/).filter(part => part.length > 0);
      candidates.push(...subParts);
    }
  }
  
  // 3. 괄호 제거한 앞부분들
  let remainingText = bkjukyo;
  while (remainingText.includes('(')) {
    const beforeParentheses = remainingText.substring(0, remainingText.indexOf('(')).trim();
    if (beforeParentheses && beforeParentheses.length > 0) {
      candidates.push(beforeParentheses);
    }
    
    // 다음 괄호를 찾기 위해 현재 괄호 제거
    const parenStart = remainingText.indexOf('(');
    const parenEnd = remainingText.indexOf(')', parenStart);
    if (parenEnd !== -1) {
      remainingText = remainingText.substring(parenEnd + 1).trim();
    } else {
      break;
    }
  }

  // 개인 이름 패턴 체크 (1-4글자 한글 이름만 있는 경우)
  const isPersonalName = /^[가-힣]{1,4}$/.test(bkjukyo.trim()) && 
                         !bkjukyo.includes('(') && 
                         !bkjukyo.includes(' ') &&
                         bkjukyo.trim().length >= 1 && bkjukyo.trim().length <= 4;
  
  // 개인 이름으로 보이는 경우, 최소한의 후보만 반환
  if (isPersonalName) {
    console.log(`⚠️ 개인 이름으로 판단: "${bkjukyo}" - 정확한 회사명 일치만 허용`);
    return [bkjukyo.trim()]; // 전체 이름만 반환하여 정확한 매칭만 허용
  }
  
  // 4. 공백, 특수문자로 분리된 단어들 추출 (개인 이름이 아닌 경우만)
  const words = bkjukyo.split(/[\s(),]+/).filter(word => 
    word.length >= 1 && // 1글자 이상으로 완화 (빈, 한 등 짧은 회사명 허용)
    !/^\d+$/.test(word) && // 숫자만인 것 제외
    !['원', '님', '씨', '대표', '사장', '회사', '입금'].includes(word) // 일반적인 단어 제외
  );
  candidates.push(...words);
  
  // 5. 한글과 영문 분리 (개인 이름이 아닌 경우만)
  const koreanParts = bkjukyo.match(/[가-힣]+/g) || [];
  const englishParts = bkjukyo.match(/[a-zA-Z]+/g) || [];
  candidates.push(...koreanParts.filter(part => part.length >= 1)); // 1글자 이상으로 완화
  candidates.push(...englishParts.filter(part => part.length >= 2));
  
  // 중복 제거 및 정리
  const uniqueCandidates = Array.from(new Set(candidates))
    .filter(candidate => 
      candidate && 
      candidate.length >= 1 && // 1글자 이상으로 완화 (빈, 한 등 짧은 회사명 허용)
      candidate.trim().length > 0
    )
    .map(candidate => candidate.trim());
  
  console.log(`입금자명 "${bkjukyo}" → 추출된 후보: [${uniqueCandidates.join(', ')}]`);
  
  return uniqueCandidates;
}

// 텍스트 정규화 함수
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w가-힣]/g, '')
    .trim();
}

// 회사명 매칭 함수
async function findMatchingCompany(supabase: any, extractedNames: string[]): Promise<string | null> {
  if (!extractedNames || extractedNames.length === 0) return null;
  
  try {
    const { data: allCompanies } = await supabase
      .from('lusso_member')
      .select('company_name')
      .not('company_name', 'is', null)
      .neq('company_name', '');
    
    if (!allCompanies || allCompanies.length === 0) return null;
    
    // 1. 정확한 매칭 시도
    for (const extractedName of extractedNames) {
      const normalizedExtracted = normalizeText(extractedName);
      
      // 정확한 매칭
      const exactMatch = allCompanies.find((company: any) => {
        const companyName = company.company_name;
        return companyName === extractedName || normalizeText(companyName) === normalizedExtracted;
      });

      if (exactMatch) {
        console.log(`✅ 정확한 매칭 성공: "${extractedName}" → "${exactMatch.company_name}"`);
        return exactMatch.company_name;
      }
    }

    // 2. 이름 패턴 분석 및 매칭
    for (const extractedName of extractedNames) {
      const normalizedExtracted = normalizeText(extractedName);
      
      // 이름 패턴 분석
      const isKoreanName = /^[가-힣]{1,4}$/.test(extractedName);
      const hasEnglish = /[a-zA-Z]/.test(extractedName);
      const hasParentheses = extractedName.includes('(') || extractedName.includes(')');
      const hasSpace = extractedName.includes(' ');
      
      // 괄호가 포함된 경우, 괄호 안의 내용 추출
      let extractedContent = extractedName;
      if (hasParentheses) {
        const match = extractedName.match(/\((.*?)\)/);
        if (match) {
          extractedContent = match[1];
          console.log(`괄호 내용 추출: "${extractedName}" → "${extractedContent}"`);
        }
      }
      
      // 이름만 있는 경우 (한글 2-4글자) - 개인 이름으로 판단되면 매칭 시도 안함
      if (isKoreanName && !hasEnglish && !hasParentheses && !hasSpace) {
        // 회사명이 정확히 일치하는지 확인
        const exactCompanyMatch = allCompanies.find((company: any) => 
          company.company_name === extractedName
        );
        
        if (exactCompanyMatch) {
          console.log(`✅ 회사명 정확히 일치: "${extractedName}"`);
          return exactCompanyMatch.company_name;
        }
        
        console.log(`⚠️ 개인 이름으로 판단됨: "${extractedName}" - 정확한 일치만 시도`);
        continue;
      }

      // 회사명 매칭 시도
      const companyMatches = allCompanies.filter((company: any) => {
        const companyName = company.company_name;
        const normalizedCompany = normalizeText(companyName);
        
        // 1. 정확한 매칭
        if (companyName === extractedName || normalizedCompany === normalizedExtracted) {
          return true;
        }
        
        // 2. 괄호 내용 매칭
        if (hasParentheses && extractedContent) {
          if (companyName.includes(extractedContent) || normalizedCompany.includes(normalizeText(extractedContent))) {
            console.log(`✅ 괄호 내용 매칭: "${extractedContent}" → "${companyName}"`);
            return true;
          }
        }
        
        // 3. 부분 매칭 (회사명이 더 긴 경우)
        if (companyName.length > extractedName.length) {
          // 괄호나 영문이 포함된 경우
          if (hasParentheses || hasEnglish) {
            // 회사명에 추출된 이름이 포함되어 있는지 확인
            return companyName.includes(extractedName) || normalizedCompany.includes(normalizedExtracted);
          }
          
          // 일반 회사명의 경우 (1글자 회사명도 허용)
          return companyName.includes(extractedName);
        }
        
        return false;
      });

      if (companyMatches.length > 0) {
        // 가장 긴 회사명을 우선 선택
        const bestMatch = companyMatches.sort((a: any, b: any) => b.company_name.length - a.company_name.length)[0];
        console.log(`✅ 부분 매칭 성공: "${extractedName}" → "${bestMatch.company_name}" (${companyMatches.length}개 후보 중 가장 긴 이름 선택)`);
        return bestMatch.company_name;
      }
    }

    // 유사도 계산 함수
    function calculateSimilarity(str1: string, str2: string): number {
      const len1 = str1.length;
      const len2 = str2.length;
      
      // 길이가 너무 다른 경우 유사도 낮게
      if (Math.abs(len1 - len2) > 5) return 0;
      
      // 정확히 일치하는 경우
      if (str1 === str2) return 1;
      
      // 부분 문자열 포함 여부
      if (str1.includes(str2) || str2.includes(str1)) {
        const longer = Math.max(len1, len2);
        const shorter = Math.min(len1, len2);
        return shorter / longer;
      }
      
      // 한글 문자열의 경우 초성, 중성, 종성 분리하여 비교
      const decomposeHangul = (str: string) => {
        const result = [];
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code >= 0xAC00 && code <= 0xD7A3) {
            const jong = code - 0xAC00;
            const jung = jong % 28;
            const cho = (jong - jung) / 28;
            result.push([cho, jung]);
          } else {
            result.push([str[i]]);
          }
        }
        return result;
      };

      const decomposed1 = decomposeHangul(str1);
      const decomposed2 = decomposeHangul(str2);
      
      // 초성, 중성, 종성 단위로 비교
      let matches = 0;
      const minLen = Math.min(decomposed1.length, decomposed2.length);
      
      for (let i = 0; i < minLen; i++) {
        const [cho1, jung1] = decomposed1[i];
        const [cho2, jung2] = decomposed2[i];
        
        // 초성이 같으면 0.5점
        if (cho1 === cho2) matches += 0.5;
        // 중성이 같으면 0.5점
        if (jung1 === jung2) matches += 0.5;
      }
      
      // 전체 길이로 나누어 유사도 계산
      const similarity = matches / Math.max(len1, len2);
      
      // 특수 케이스: "천안정이네"와 "정이네" 같은 경우
      if (str1.includes(str2) || str2.includes(str1)) {
        const longer = Math.max(len1, len2);
        const shorter = Math.min(len1, len2);
        return Math.max(similarity, shorter / longer);
      }
      
      return similarity;
    }

    // 3. 포함 관계 우선 체크 + 유사도 분석 (정확한 매칭이 없는 경우)
    let bestMatch = null;
    let highestSimilarity = 0;

    for (const extractedName of extractedNames) {
      // 개인 이름으로 보이는 경우 먼저 회사명 부분 매칭 확인
      const isPersonalName = /^[가-힣]{2,4}$/.test(extractedName) && 
                            !extractedName.includes('(') && 
                            !extractedName.includes(' ') &&
                            extractedName.length <= 4;
      
      if (isPersonalName) {
        // 개인 이름처럼 보여도 회사명에 포함되는지 먼저 확인
        const matchingCompany = allCompanies.find((company: any) => 
          company.company_name.includes(extractedName)
        );
        
        if (!matchingCompany) {
          console.log(`⚠️ 개인 이름으로 판단되어 유사도 매칭 건너뛰기: "${extractedName}"`);
          continue;
        } else {
          console.log(`✅ 개인 이름 같지만 회사명 일부로 확인됨: "${extractedName}" → "${matchingCompany.company_name}"`);
          return matchingCompany.company_name;
        }
      }
      
      // 🎯 포함 관계 우선 체크 (띠띠모어 → 부산띠띠모어 같은 케이스)
      for (const company of allCompanies) {
        const companyName = company.company_name;
        
        // 입금자명이 회사명에 완전히 포함되는 경우 (3글자 이상)
        if (extractedName.length >= 3 && companyName.includes(extractedName)) {
          console.log(`✅ 포함 관계 매칭 성공: "${extractedName}" → "${companyName}" (포함관계)`);
          return companyName;
        }
      }
      
      const normalizedExtracted = normalizeText(extractedName);
      
      for (const company of allCompanies) {
        const companyName = company.company_name;
        const normalizedCompany = normalizeText(companyName);
        
        // 유사도 계산
        const similarity = calculateSimilarity(normalizedExtracted, normalizedCompany);
        
        if (similarity > highestSimilarity && similarity > 0.75) { // 75% 이상 유사도 (개인이름 필터링으로 보완)
          highestSimilarity = similarity;
          bestMatch = company;
          console.log(`   유사도 매칭 후보: "${companyName}" (유사도: ${(similarity * 100).toFixed(1)}%)`);
        }
      }
    }

    if (bestMatch) {
      console.log(`✅ 유사도 매칭 성공: "${extractedNames[0]}" → "${bestMatch.company_name}" (유사도: ${(highestSimilarity * 100).toFixed(1)}%)`);
      return bestMatch.company_name;
    }

    return null;
  } catch (error) {
    console.error("회사명 매칭 중 오류:", error);
    return null;
  }
}

// POST - 수동 뱅크다 동기화 (날짜 범위 지정 가능)
export async function POST(request: NextRequest) {
  try {
    console.log(`[${getKoreaTime()}] 수동 뱅크다 동기화 시작`);
    
    const body = await request.json();
    const { startDate, endDate } = body;
    
    // 기본값: 06-01부터 오늘까지
    const today = new Date();
    const koreanTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    
    const defaultStartDate = '2024-06-01';
    const defaultEndDate = koreanTime.toISOString().split('T')[0];
    
    const datefrom = startDate || defaultStartDate;
    const dateto = endDate || defaultEndDate;
    
    console.log(`수동 동기화 날짜 범위: ${datefrom} ~ ${dateto}`);
    
    const result = await performBankdaSyncWithDateRange(datefrom, dateto);
    
    console.log(`[${getKoreaTime()}] 수동 뱅크다 동기화 완료: ${result.message}`);
    
    return NextResponse.json({
      success: true,
      message: `수동 뱅크다 동기화가 완료되었습니다.`,
      syncTime: getKoreaTime(),
      dateRange: { from: datefrom, to: dateto },
      processed: result.processed,
      total: result.total,
      details: result.details || []
    });
    
  } catch (error) {
    console.error('수동 뱅크다 동기화 중 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '수동 뱅크다 동기화 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        syncTime: getKoreaTime()
      },
      { status: 500 }
    );
  }
}

// 날짜 범위를 지정한 뱅크다 동기화 함수
async function performBankdaSyncWithDateRange(datefrom: string, dateto: string) {
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
    data.append('accountnum', '57370104214209');
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
    console.log('뱅크다 API 응답 전체:', JSON.stringify(bankdaResponse.data, null, 2));
    
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
    const details: any[] = [];
    
    // 4. 각 입금 거래 처리
    for (const transaction of deposits) {
      let transactionDetail: any = {
        date: transaction.bkdate,
        time: transaction.bktime,
        amount: parseInt(transaction.bkinput),
        depositor: transaction.bkjukyo,
        extractedNames: [],
        matchedCompany: null,
        status: 'pending',
        error: null
      };
      
      try {
        processedCount++;
        
        const extractedNames = extractCompanyName(transaction.bkjukyo);
        const matchedCompany = await findMatchingCompany(supabase, extractedNames);
        
        transactionDetail = {
          date: transaction.bkdate,
          time: transaction.bktime,
          amount: parseInt(transaction.bkinput),
          depositor: transaction.bkjukyo,
          extractedNames,
          matchedCompany,
          status: 'pending',
          error: null
        };
        
        if (!matchedCompany) {
          console.log(`매칭 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')}`);
          transactionDetail.status = 'failed';
          transactionDetail.error = '매칭되는 회사를 찾을 수 없음';
          details.push(transactionDetail);
          
          await logMileageFailure({
            business_name: transaction.bkjukyo || "알 수 없음",
            attempted_amount: parseInt(transaction.bkinput) || 0,
            reason: MILEAGE_FAILURE_REASONS.MEMBER_NOT_FOUND,
            error_details: `수동 뱅크다 매칭 실패: ${transaction.bkjukyo} → ${extractedNames.join(', ')}`,
            settlement_type: "bankda_manual_sync",
            settlement_date: transaction.bkdate || getKoreaDate(),
            original_data: transaction,
          });
          
          continue;
        }
        
        // 강화된 중복 체크
        const { data: existingRecord } = await supabase
          .from('mileage')
          .select('id')
          .ilike('description', `%[${transaction.bkcode}]%`)
          .in('source', ['bankda_auto', 'bankda_manual'])
          .single();
        
        if (existingRecord) {
          console.log(`중복 거래 건너뛰기: [${transaction.bkcode}] ${matchedCompany}`);
          transactionDetail.status = 'duplicate';
          transactionDetail.error = '이미 처리된 거래 (거래코드 중복)';
          details.push(transactionDetail);
          continue;
        }

        // 추가 중복 체크: 동일한 날짜, 시간, 금액, 업체명으로 이미 처리된 건이 있는지 확인
        const { data: duplicateCheck } = await supabase
          .from('mileage')
          .select('id')
          .eq('amount', parseInt(transaction.bkinput))
          .ilike('description', `%${transaction.bkjukyo}%`)
          .ilike('description', `%${transaction.bkdate}%`)
          .ilike('description', `%${transaction.bktime}%`)
          .in('source', ['bankda_auto', 'bankda_manual'])
          .single();
        
        if (duplicateCheck) {
          console.log(`중복 거래 건너뛰기 (날짜/시간/금액 일치): ${transaction.bkdate} ${transaction.bktime} - ${matchedCompany}, ${parseInt(transaction.bkinput)}원`);
          transactionDetail.status = 'duplicate';
          transactionDetail.error = '이미 처리된 거래 (날짜/시간/금액 일치)';
          details.push(transactionDetail);
          continue;
        }
        
        // 사용자 ID 조회 (회사명으로 사용자 찾기)
        const { data: userRecord } = await supabase
          .from('users')
          .select('id, mileage_balance')
          .eq('company_name', matchedCompany)
          .single();
        
        if (!userRecord) {
          console.log(`사용자를 찾을 수 없음: ${matchedCompany}`);
          transactionDetail.status = 'failed';
          transactionDetail.error = '사용자를 찾을 수 없음';
          details.push(transactionDetail);
          continue;
        }
        
        // 마일리지 등록 (수동 동기화와 동일한 방식)
        const now = new Date();
        const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const currentTime = koreanTime.toISOString();
        
        const insertData = {
          user_id: userRecord.id,
          amount: parseInt(transaction.bkinput),
          type: 'earn', // 적립
          source: 'bankda_manual',
          description: `수동동기화: ${transaction.bkjukyo} (${transaction.bkdate} ${transaction.bktime}) [${transaction.bkcode}]`,
          status: 'completed',
          created_at: currentTime,
          updated_at: currentTime
        };
        
        const { error } = await supabase
          .from('mileage')
          .insert(insertData);
        
        if (error) {
          console.error(`마일리지 등록 실패 (${matchedCompany}):`, error);
          transactionDetail.status = 'error';
          transactionDetail.error = error.message;
          details.push(transactionDetail);
          
          // 실패 로그 기록
          await logMileageFailure({
            business_name: matchedCompany,
            attempted_amount: parseInt(transaction.bkinput),
            reason: MILEAGE_FAILURE_REASONS.API_ERROR,
            error_details: `수동 뱅크다 등록 실패: ${error.message}`,
            settlement_type: "bankda_manual_sync",
            settlement_date: transaction.bkdate || getKoreaDate(),
            original_data: { transaction, error: error.message },
          });
        } else {
          // 사용자 마일리지 잔액 업데이트
          const newBalance = (userRecord.mileage_balance || 0) + parseInt(transaction.bkinput);
          await supabase
            .from('users')
            .update({ mileage_balance: newBalance })
            .eq('id', userRecord.id);
          
          successCount++;
          transactionDetail.status = 'success';
          details.push(transactionDetail);
          console.log(`✅ 마일리지 등록 성공: ${matchedCompany} (+${parseInt(transaction.bkinput)})`);
        }
        
      } catch (error) {
        console.error(`거래 처리 중 오류:`, error);
        transactionDetail.status = 'error';
        transactionDetail.error = error instanceof Error ? error.message : '알 수 없는 오류';
        details.push(transactionDetail);
      }
    }
    
    return {
      message: `처리 완료: ${successCount}/${processedCount}건 성공`,
      processed: successCount,
      total: processedCount,
      details
    };
    
  } catch (error) {
    console.error('뱅크다 동기화 오류:', error);
    throw error;
  }
} 

// 실제 뱅크다 API 상태 확인 (PUT 요청 추가)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'check_today_deposits') {
      console.log(`[${getKoreaTime()}] 오늘 입금건 조회 시작`);
      
      // 오늘 날짜로 뱅크다 API 호출
      const now = new Date();
      const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const today = koreanTime.toISOString().split('T')[0].replace(/-/g, '');
      
      const result = await queryBankdaDeposits(today, today);
      
      return NextResponse.json({
        success: true,
        message: '오늘 입금건 조회 완료',
        checkTime: getKoreaTime(),
        data: result
      });
    }
    
    if (action === 'check_sync_status') {
      console.log(`[${getKoreaTime()}] 뱅크다 동기화 상태 확인`);
      
      const isEnabled = await checkBankdaAutoSyncStatus();
      
      // 최근 동기화 로그 확인
      const supabase = await createClient();
      const { data: recentLogs } = await supabase
        .from('lusso_mileage_failure_logs')
        .select('*')
        .gte('created_at', getKoreaDate())
        .order('created_at', { ascending: false })
        .limit(10);
      
      return NextResponse.json({
        success: true,
        message: '뱅크다 상태 확인 완료',
        checkTime: getKoreaTime(),
        data: {
          auto_sync_enabled: isEnabled,
          recent_failure_logs: recentLogs || [],
          failure_count_today: recentLogs?.length || 0
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: '알 수 없는 액션입니다.'
    }, { status: 400 });
    
  } catch (error) {
    console.error('뱅크다 상태 확인 중 오류:', error);
    return NextResponse.json({
      success: false,
      error: '뱅크다 상태 확인 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 뱅크다 입금 데이터 조회 함수 (단순 조회용)
async function queryBankdaDeposits(datefrom: string, dateto: string) {
  const axios = require('axios');
  const FormData = require('form-data');
  
  const BANKDA_API_URL = 'https://a.bankda.com/dtsvc/bank_tr.php';
  const BANKDA_ACCESS_TOKEN = '9d92ac153d211e16fa5baf1d3711b772';
  
  try {
    console.log(`뱅크다 입금건 조회: ${datefrom} ~ ${dateto}`);
    
    let data = new FormData();
    data.append('datefrom', datefrom);
    data.append('dateto', dateto);
    data.append('accountnum', '57370104214209');
    data.append('datatype', 'json');
    data.append('charset', 'utf8');
    data.append('istest', 'n');

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
    console.log('뱅크다 API 응답:', JSON.stringify(bankdaResponse.data, null, 2));
    
    if (!bankdaResponse.data || !bankdaResponse.data.response) {
      throw new Error('뱅크다 API 응답이 올바르지 않습니다.');
    }
    
    const response = bankdaResponse.data.response;
    const bankData = response.bank || [];
    
    // 입금 거래만 필터링
    const deposits = bankData.filter((transaction: any) => 
      parseInt(transaction.bkinput) > 0 && parseInt(transaction.bkoutput) === 0
    );
    
         return {
       total_transactions: bankData.length,
       deposits: deposits.length,
       deposit_data: deposits.map((dep: any) => ({
         date: dep.bkdate,
         time: dep.bktime,
         amount: parseInt(dep.bkinput),
         depositor: dep.bkjukyo,
         code: dep.bkcode
       })),
       raw_response: response
     };
    
  } catch (error) {
    console.error('뱅크다 입금건 조회 오류:', error);
    throw error;
  }
} 