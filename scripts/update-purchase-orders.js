const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePurchaseOrders() {
  try {
    console.log("🔍 발주 주문 업데이트 시작...");

    // 발주 주문으로 추정되는 주문들 조회
    // 조건: 주문번호가 특정 패턴이거나, 특정 사용자들의 주문
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        order_type,
        created_at,
        users:users!orders_user_id_fkey (
          company_name,
          username
        )
      `
      )
      .eq("order_type", "normal")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("주문 조회 실패:", fetchError);
      return;
    }

    console.log(`📊 총 ${orders.length}개의 일반 주문 발견`);

    // 발주 주문으로 추정되는 주문들 필터링
    // 여기서는 사용자에게 확인을 받는 방식으로 진행
    console.log("\n🔍 발주 주문으로 추정되는 주문들:");

    const potentialPurchaseOrders = [];

    for (const order of orders) {
      const user = Array.isArray(order.users) ? order.users[0] : order.users;

      // 발주 주문 판별 조건 (필요시 수정)
      const isPurchaseOrder =
        order.order_number.includes("P0") || // 발주 주문번호 패턴
        (user && user.company_name && user.company_name.includes("루소")) || // 내부 발주
        order.created_at > "2024-01-01"; // 최근 주문만 (필요시 수정)

      if (isPurchaseOrder) {
        potentialPurchaseOrders.push(order);
        console.log(
          `  - ${order.order_number} (${user?.company_name || "N/A"}) - ${
            order.created_at
          }`
        );
      }
    }

    console.log(
      `\n📋 발주 주문으로 추정되는 주문: ${potentialPurchaseOrders.length}개`
    );

    if (potentialPurchaseOrders.length === 0) {
      console.log("✅ 업데이트할 발주 주문이 없습니다.");
      return;
    }

    // 사용자 확인 (실제 운영에서는 주의깊게 확인 필요)
    console.log(
      "\n⚠️  위 주문들을 발주 주문(order_type: purchase)로 변경하시겠습니까?"
    );
    console.log("⚠️  이 작업은 되돌릴 수 있지만 신중하게 진행해주세요.");

    // 실제 업데이트 진행
    const orderIdsToUpdate = potentialPurchaseOrders.map((order) => order.id);

    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({ order_type: "purchase" })
      .in("id", orderIdsToUpdate)
      .select();

    if (updateError) {
      console.error("❌ 주문 업데이트 실패:", updateError);
      return;
    }

    console.log(
      `✅ ${updatedOrders.length}개 주문의 order_type을 'purchase'로 업데이트 완료!`
    );

    // 업데이트된 주문 확인
    console.log("\n📋 업데이트된 주문들:");
    for (const order of updatedOrders) {
      console.log(
        `  - ${order.order_number} -> order_type: ${order.order_type}`
      );
    }
  } catch (error) {
    console.error("❌ 스크립트 실행 오류:", error);
  }
}

// 더 안전한 방법: 특정 주문번호들만 업데이트
async function updateSpecificOrders() {
  try {
    console.log("🔍 특정 발주 주문 업데이트 시작...");

    // 발주 주문번호 패턴 (P0로 시작하는 주문들)
    const { data: purchaseOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_number, order_type")
      .like("order_number", "P0%")
      .eq("order_type", "normal");

    if (fetchError) {
      console.error("주문 조회 실패:", fetchError);
      return;
    }

    if (purchaseOrders.length === 0) {
      console.log("✅ P0로 시작하는 발주 주문이 없습니다.");
      return;
    }

    console.log(`📊 P0로 시작하는 발주 주문: ${purchaseOrders.length}개`);

    const orderIds = purchaseOrders.map((order) => order.id);

    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({ order_type: "purchase" })
      .in("id", orderIds)
      .select();

    if (updateError) {
      console.error("❌ 주문 업데이트 실패:", updateError);
      return;
    }

    console.log(`✅ ${updatedOrders.length}개 발주 주문 업데이트 완료!`);
  } catch (error) {
    console.error("❌ 스크립트 실행 오류:", error);
  }
}

// 실행
console.log("🚀 발주 주문 order_type 업데이트 스크립트");
console.log("1. 모든 주문 검토 후 업데이트");
console.log("2. P0로 시작하는 주문만 업데이트");

// 안전한 방법부터 실행
updateSpecificOrders()
  .then(() => {
    console.log("\n🎉 스크립트 실행 완료!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 스크립트 실행 실패:", error);
    process.exit(1);
  });
