import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/shared/lib/supabase"

interface TrackingUpdateItem {
  orderNumber: string
  trackingNumber: string
  courier?: string
  notes?: string
}

interface SuccessResult {
  orderNumber: string
  trackingNumber: string
  courier?: string
}

interface FailedResult {
  orderNumber: string
  error: string
}

// POST /api/admin/orders/bulk-tracking - 운송장 번호 일괄 업데이트
export async function POST(request: NextRequest) {
  try {
    const body: { trackingData: TrackingUpdateItem[] } = await request.json()
    
    if (!body.trackingData || !Array.isArray(body.trackingData)) {
      return NextResponse.json({
        success: false,
        error: "유효하지 않은 데이터 형식입니다."
      }, { status: 400 })
    }

    const results: {
      success: SuccessResult[]
      failed: FailedResult[]
    } = {
      success: [],
      failed: []
    }

    // 각 주문에 대해 운송장 번호 업데이트
    for (const item of body.trackingData) {
      try {
        // 주문 존재 확인
        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("id, status")
          .eq("order_number", item.orderNumber)
          .single()

        if (fetchError || !order) {
          results.failed.push({
            orderNumber: item.orderNumber,
            error: "주문을 찾을 수 없습니다."
          })
          continue
        }

        // 주문 상태가 confirmed가 아닌 경우 확인
        if (order.status !== "confirmed") {
          results.failed.push({
            orderNumber: item.orderNumber,
            error: `주문 상태가 주문확정이 아닙니다. (현재: ${order.status})`
          })
          continue
        }

        // 운송장 번호 업데이트 및 상태를 배송중으로 변경
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            tracking_number: item.trackingNumber,
            courier: item.courier || null,
            status: "shipped",
            updated_at: new Date().toISOString()
          })
          .eq("id", order.id)

        if (updateError) {
          console.error("Order update error:", updateError)
          results.failed.push({
            orderNumber: item.orderNumber,
            error: "운송장 번호 업데이트에 실패했습니다."
          })
          continue
        }

        results.success.push({
          orderNumber: item.orderNumber,
          trackingNumber: item.trackingNumber,
          courier: item.courier
        })

      } catch (error) {
        console.error(`Error processing order ${item.orderNumber}:`, error)
        results.failed.push({
          orderNumber: item.orderNumber,
          error: "처리 중 오류가 발생했습니다."
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total: body.trackingData.length,
          success: results.success.length,
          failed: results.failed.length
        },
        results
      },
      message: `총 ${body.trackingData.length}건 중 ${results.success.length}건 성공, ${results.failed.length}건 실패`
    })

  } catch (error) {
    console.error("Bulk tracking update error:", error)
    return NextResponse.json({
      success: false,
      error: "서버 오류가 발생했습니다."
    }, { status: 500 })
  }
}
