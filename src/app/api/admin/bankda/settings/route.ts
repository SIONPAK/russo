import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

// GET - 뱅크다 설정 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 뱅크다 관련 설정 조회
    const { data: settings, error } = await supabase
      .from('lusso_system_settings')
      .select('*')
      .in('key', ['bankda_auto_sync_enabled', 'bankda_api_token', 'bankda_account_number']);
    
    if (error) {
      console.error('뱅크다 설정 조회 오류:', error);
      return NextResponse.json({ 
        success: false,
        error: '뱅크다 설정 조회 중 오류가 발생했습니다.' 
      }, { status: 500 });
    }
    
    if (!settings) {
      return NextResponse.json({ 
        success: true,
        data: {
          auto_sync: false,
          last_sync: null,
          sync_interval: 24
        }
      });
    }
    
    // 설정을 객체로 변환
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
    
    // 프론트엔드에서 기대하는 형태로 변환
    const responseData = {
      auto_sync: settingsObj.bankda_auto_sync_enabled === 'true',
      last_sync: null, // 필요시 추가
      sync_interval: 24,
      api_token: settingsObj.bankda_api_token || '',
      account_number: settingsObj.bankda_account_number || ''
    };
    
    return NextResponse.json({ 
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('뱅크다 설정 조회 중 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '뱅크다 설정 조회 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

// POST - 뱅크다 설정 업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('받은 요청 데이터:', body);
    
    const { enabled, apiToken, accountNumber } = body;
    
    const supabase = await createClient();
    
    // 설정 업데이트
    const updatePromises = [];
    
    if (enabled !== undefined) {
      console.log('enabled 설정 업데이트:', enabled);
      const updateResult = supabase
        .from('lusso_system_settings')
        .upsert({
          key: 'bankda_auto_sync_enabled',
          value: String(enabled), // 문자열로 변환
          description: '뱅크다 자동 동기화 활성화 여부'
        }, {
          onConflict: 'key'
        });
      updatePromises.push(updateResult);
    }
    
    if (apiToken !== undefined) {
      console.log('apiToken 설정 업데이트:', apiToken);
      updatePromises.push(
        supabase
          .from('lusso_system_settings')
          .upsert({
            key: 'bankda_api_token',
            value: apiToken,
            description: '뱅크다 API 액세스 토큰'
          }, {
            onConflict: 'key'
          })
      );
    }
    
    if (accountNumber !== undefined) {
      console.log('accountNumber 설정 업데이트:', accountNumber);
      updatePromises.push(
        supabase
          .from('lusso_system_settings')
          .upsert({
            key: 'bankda_account_number',
            value: accountNumber,
            description: '뱅크다 연동 계좌번호'
          }, {
            onConflict: 'key'
          })
      );
    }
    
    console.log('updatePromises 개수:', updatePromises.length);
    const results = await Promise.all(updatePromises);
    console.log('업데이트 결과:', results);
    
    // 오류가 있는지 확인
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('설정 업데이트 중 오류:', errors);
      return NextResponse.json(
        { error: '설정 업데이트 중 오류가 발생했습니다.', details: errors },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: '뱅크다 설정이 업데이트되었습니다.' 
    });
    
  } catch (error) {
    console.error('뱅크다 설정 업데이트 중 오류:', error);
    return NextResponse.json(
      { error: '뱅크다 설정 업데이트 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// PUT - 뱅크다 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT 요청 데이터:', body);
    
    const { auto_sync, enabled, apiToken, accountNumber } = body;
    
    // auto_sync와 enabled 둘 다 지원
    const autoSyncValue = auto_sync !== undefined ? auto_sync : enabled;
    
    const supabase = await createClient();
    
    // 설정 업데이트
    const updatePromises = [];
    
    if (autoSyncValue !== undefined) {
      console.log('auto_sync 설정 업데이트:', autoSyncValue);
      const updateResult = supabase
        .from('lusso_system_settings')
        .upsert({
          key: 'bankda_auto_sync_enabled',
          value: String(autoSyncValue), // 문자열로 변환
          description: '뱅크다 자동 동기화 활성화 여부'
        }, {
          onConflict: 'key'
        });
      updatePromises.push(updateResult);
    }
    
    if (apiToken !== undefined) {
      console.log('apiToken 설정 업데이트:', apiToken);
      updatePromises.push(
        supabase
          .from('lusso_system_settings')
          .upsert({
            key: 'bankda_api_token',
            value: apiToken,
            description: '뱅크다 API 액세스 토큰'
          }, {
            onConflict: 'key'
          })
      );
    }
    
    if (accountNumber !== undefined) {
      console.log('accountNumber 설정 업데이트:', accountNumber);
      updatePromises.push(
        supabase
          .from('lusso_system_settings')
          .upsert({
            key: 'bankda_account_number',
            value: accountNumber,
            description: '뱅크다 연동 계좌번호'
          }, {
            onConflict: 'key'
          })
      );
    }
    
    console.log('updatePromises 개수:', updatePromises.length);
    const results = await Promise.all(updatePromises);
    console.log('업데이트 결과:', results);
    
    // 오류가 있는지 확인
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('설정 업데이트 중 오류:', errors);
      return NextResponse.json(
        { error: '설정 업데이트 중 오류가 발생했습니다.', details: errors },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: '뱅크다 설정이 업데이트되었습니다.' 
    });
    
  } catch (error) {
    console.error('뱅크다 설정 업데이트 중 오류:', error);
    return NextResponse.json(
      { error: '뱅크다 설정 업데이트 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
} 