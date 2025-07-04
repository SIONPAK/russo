const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL 또는 Service Role Key가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  try {
    console.log("시드 데이터 생성을 시작합니다...");

    // 비밀번호 해시 생성
    const adminPassword = await bcrypt.hash("admin123", 10);
    const testPassword = await bcrypt.hash("test123", 10);

    // 1. 관리자 계정 생성
    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .upsert([
        {
          username: "admin",
          email: "admin@lusso.com",
          password_hash: adminPassword,
          role: "super_admin",
        },
      ])
      .select();

    if (adminError) {
      console.error("관리자 계정 생성 오류:", adminError);
    } else {
      console.log("✅ 관리자 계정이 생성되었습니다.");
    }

    // 2. 테스트 사용자 계정 생성
    const testUsers = [
      {
        user_id: "test1",
        email: "test1@company.com",
        password_hash: testPassword,
        company_name: "(주)테스트컴퍼니",
        business_number: "123-45-67890",
        representative_name: "김대표",
        phone: "010-1234-5678",
        address: "서울시 강남구 테헤란로 123",
        postal_code: "12345",
        recipient_name: "김수령",
        recipient_phone: "010-9876-5432",
        approval_status: "pending",
      },
      {
        user_id: "approved",
        email: "approved@company.com",
        password_hash: testPassword,
        company_name: "승인된회사(주)",
        business_number: "987-65-43210",
        representative_name: "이대표",
        phone: "010-2222-3333",
        address: "부산시 해운대구 해운대로 456",
        postal_code: "48000",
        recipient_name: "이수령",
        recipient_phone: "010-1111-2222",
        approval_status: "approved",
      },
      {
        user_id: "rejected",
        email: "rejected@company.com",
        password_hash: testPassword,
        company_name: "거절된회사",
        business_number: "555-55-55555",
        representative_name: "박대표",
        phone: "010-5555-6666",
        address: "대구시 중구 동성로 789",
        postal_code: "41900",
        recipient_name: "박수령",
        recipient_phone: "010-7777-8888",
        approval_status: "rejected",
        is_active: false,
      },
      {
        user_id: "inactive",
        email: "inactive@company.com",
        password_hash: testPassword,
        company_name: "비활성회사",
        business_number: "111-22-33333",
        representative_name: "최대표",
        phone: "010-1111-2222",
        address: "인천시 남동구 구월로 321",
        postal_code: "21900",
        recipient_name: "최수령",
        recipient_phone: "010-3333-4444",
        approval_status: "approved",
        is_active: false,
      },
    ];

    const { data: users, error: usersError } = await supabase
      .from("users")
      .upsert(testUsers)
      .select();

    if (usersError) {
      console.error("테스트 사용자 생성 오류:", usersError);
    } else {
      console.log(`✅ ${users.length}개의 테스트 사용자가 생성되었습니다.`);
    }

    // 3. 카테고리 메뉴 생성
    const categoryMenus = [
      { name: "NEW", key: "new", path: "/?category=new", order_index: 1 },
      {
        name: "WOMAN",
        key: "womans",
        path: "/?category=womans",
        order_index: 2,
      },
      {
        name: "TR",
        key: "training",
        path: "/?category=training",
        order_index: 3,
      },
      { name: "DENIM", key: "denim", path: "/?category=denim", order_index: 4 },
      {
        name: "COTTON",
        key: "cotton",
        path: "/?category=cotton",
        order_index: 5,
      },
      {
        name: "SLACKS",
        key: "slacks",
        path: "/?category=slacks",
        order_index: 6,
      },
      {
        name: "언더웨어",
        key: "underwear",
        path: "/?category=underwear",
        order_index: 7,
        badge: "🔥",
      },
      {
        name: "T & SHIRT",
        key: "tshirt",
        path: "/?category=tshirt",
        order_index: 8,
      },
      { name: "OUTER", key: "outer", path: "/?category=outer", order_index: 9 },
      {
        name: "ON SALE",
        key: "sale",
        path: "/?category=sale",
        order_index: 10,
        is_special: true,
        text_color: "#dc2626",
      },
    ];

    const { data: menus, error: menusError } = await supabase
      .from("category_menus")
      .upsert(categoryMenus)
      .select();

    if (menusError) {
      console.error("카테고리 메뉴 생성 오류:", menusError);
    } else {
      console.log(`✅ ${menus.length}개의 카테고리 메뉴가 생성되었습니다.`);
    }

    console.log("🎉 시드 데이터 생성이 완료되었습니다!");
    console.log("");
    console.log("관리자 로그인 정보:");
    console.log("- 아이디: admin");
    console.log("- 비밀번호: admin123");
    console.log("");
    console.log("테스트 사용자 로그인 정보:");
    console.log("- test1@company.com / test123 (승인 대기)");
    console.log("- approved@company.com / test123 (승인 완료)");
    console.log("- rejected@company.com / test123 (반려)");
    console.log("- inactive@company.com / test123 (비활성)");
  } catch (error) {
    console.error("시드 데이터 생성 중 오류 발생:", error);
    process.exit(1);
  }
}

seedData();
