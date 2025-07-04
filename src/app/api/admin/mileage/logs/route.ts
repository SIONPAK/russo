import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase';

// GET - 마일리지 로그 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId') || '';
    const type = searchParams.get('type') || ''; // 'bankda_sync_success', 'bankda_sync_failed', 'manual_process' 등
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    
    const offset = (page - 1) * limit;
    const supabase = createClient();
    
    let query = supabase
      .from('mileage_logs')
      .select(`
        *,
        users!mileage_logs_user_id_fkey (
          id,
          company_name,
          representative_name,
          email
        )
      `, { count: 'exact' });
    
    // 필터 적용
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }
    
    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      // 종료일은 해당 날짜 23:59:59까지 포함
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateTime.toISOString());
    }
    
    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    const { data: logs, error, count } = await query;
    
    if (error) {
      console.error('Mileage logs fetch error:', error);
      return NextResponse.json({
        success: false,
        error: '마일리지 로그를 불러오는데 실패했습니다.'
      }, { status: 500 });
    }
    
    const totalPages = Math.ceil((count || 0) / limit);
    
    return NextResponse.json({
      success: true,
      data: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    });
    
  } catch (error) {
    console.error('Mileage logs API error:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// POST - 마일리지 로그 생성 (수동 로그 추가)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
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

// DELETE - 로그 삭제 (관리자용)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('id');
    const logType = searchParams.get('type'); // 'failure' or 'exclusion'
    
    if (!logId || !logType) {
      return NextResponse.json(
        { success: false, error: '로그 ID와 타입이 필요합니다.' },
        { status: 400 }
      );
    }
    
    const supabase = createClient();
    const tableName = logType === 'failure' ? 'lusso_mileage_failure_logs' : 'lusso_mileage_exclusion_logs';
    
    const { error } = await supabase
      .from(tableName)
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