import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

// GET - 마일리지 실패 로그 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'failure';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const supabase = await createClient();
    
    let query = supabase
      .from('lusso_mileage_failure_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // 상태 필터링 (기본값: 대기중만)
    const status = searchParams.get('status') || 'pending';
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    // 오늘 날짜 필터링 (옵션)
    const today = searchParams.get('today');
    if (today === 'true') {
      const koreanDate = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', koreanDate);
    }
    
    const { data: logs, error } = await query;
    
    if (error) {
      console.error('마일리지 실패 로그 조회 오류:', error);
      return NextResponse.json({ 
        success: false,
        error: '마일리지 실패 로그 조회 중 오류가 발생했습니다.' 
      }, { status: 500 });
    }
    
    // 로그 데이터 변환
    const transformedLogs = logs?.map((log: any) => ({
      id: log.id,
      business_name: log.business_name,
      attempted_amount: log.attempted_amount,
      reason: log.reason,
      error_details: log.error_details,
      settlement_type: log.settlement_type,
      settlement_date: log.settlement_date,
      status: log.status || 'pending',
      created_at: log.created_at,
      error_message: log.error_details, // 기존 프론트엔드 호환성을 위해
      amount: log.attempted_amount,
      user_name: log.business_name
    })) || [];
    
    return NextResponse.json({ 
      success: true,
      data: transformedLogs,
      total: transformedLogs.length,
      message: `${transformedLogs.length}건의 실패 로그를 조회했습니다.`
    });
    
  } catch (error) {
    console.error('마일리지 실패 로그 조회 중 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '마일리지 실패 로그 조회 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

// POST - 마일리지 로그 생성 (수동 로그 추가)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      user_id,
      type,
      amount,
      reason,
      reference_id = null,
      reference_type = null,
      description
    } = body;

    // 필수 필드 검증
    if (!type || !amount || !reason) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 });
    }

    // 마일리지 로그 생성
    const { data: log, error } = await supabase
      .from('mileage_logs')
      .insert({
        user_id,
        type,
        amount,
        reason,
        reference_id,
        reference_type,
        description
      })
      .select(`
        *,
        users!mileage_logs_user_id_fkey (
          id,
          company_name,
          representative_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Mileage log creation error:', error);
      return NextResponse.json({
        success: false,
        error: '마일리지 로그 생성에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: log,
      message: '마일리지 로그가 성공적으로 생성되었습니다.'
    });
    
  } catch (error) {
    console.error('Mileage log creation API error:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// PUT - 로그 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId, status } = body;
    
    if (!logId || !status) {
      return NextResponse.json(
        { success: false, error: '로그 ID와 상태가 필요합니다.' },
        { status: 400 }
      );
    }
    
    if (!['pending', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상태입니다. (pending, resolved)' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('lusso_mileage_failure_logs')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', logId);
    
    if (error) {
      console.error('로그 상태 업데이트 오류:', error);
      return NextResponse.json(
        { success: false, error: '로그 상태 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `로그 상태가 ${status === 'resolved' ? '해결완료' : '대기중'}로 변경되었습니다.`
    });
    
  } catch (error) {
    console.error('로그 상태 업데이트 중 오류:', error);
    return NextResponse.json(
      { success: false, error: '로그 상태 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 로그 삭제 (관리자용)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId } = body;
    
    if (!logId) {
      return NextResponse.json(
        { success: false, error: '로그 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('lusso_mileage_failure_logs')
      .delete()
      .eq('id', logId);
    
    if (error) {
      console.error('로그 삭제 오류:', error);
      return NextResponse.json(
        { success: false, error: '로그 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '로그가 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('로그 삭제 중 오류:', error);
    return NextResponse.json(
      { success: false, error: '로그 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 