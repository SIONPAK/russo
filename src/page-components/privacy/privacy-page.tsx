'use client'

import { MainLayout } from '@/widgets/layout/main-layout'

export function PrivacyPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-8">
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">개인정보 취급방침</h1>
                <p className="text-gray-600 mb-8 text-sm">
                  루소는 고객님의 개인정보를 중요시하며, "정보통신망 이용촉진 및 정보보호"에 관한 법률을 준수하고 있습니다.
                </p>
              </div>

              {/* 수집하는 개인정보 항목 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 수집하는 개인정보 항목</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
                  <div className="space-y-2">
                    <p><strong>○ 수집항목:</strong> 이름, 생년월일, 성별, 로그인ID, 비밀번호, 자택 전화번호, 자택 주소, 휴대전화번호, 이메일, 회사명, 부서, 직책, 회사전화번호, 사업자등록번호, 사업자등록증, 서비스 이용기록, 접속 로그, 접속 IP 정보, 결제기록</p>
                    <p><strong>○ 개인정보 수집방법:</strong> 홈페이지(회원가입), 서면양식</p>
                  </div>
                </div>
              </section>

              {/* 개인정보의 수집 및 이용목적 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보의 수집 및 이용목적</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
                  <div className="space-y-2">
                    <p><strong>○ 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산</strong><br />
                    콘텐츠 제공, 구매 및 요금 결제, 물품배송 또는 청구지 등 발송</p>
                    <p><strong>○ 회원 관리</strong><br />
                    회원제 서비스 이용에 따른 본인확인, 개인 식별, 연령확인, 만14세 미만 아동 개인정보 수집 시 법정 대리인 동의여부 확인, 고지사항 전달</p>
                    <p><strong>○ 마케팅 및 광고에 활용</strong><br />
                    접속 빈도 파악 또는 회원의 서비스 이용에 대한 통계</p>
                  </div>
                </div>
              </section>

              {/* 개인정보의 보유 및 이용기간 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보의 보유 및 이용기간</h2>
                <p className="text-gray-700 leading-relaxed text-sm">
                  회사는 개인정보 수집 및 이용목적이 달성된 후에는 예외 없이 해당 정보를 지체 없이 파기합니다.
                </p>
              </section>

              {/* 개인정보의 파기절차 및 방법 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보의 파기절차 및 방법</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체없이 파기합니다.</p>
                  <div className="space-y-2">
                    <p><strong>○ 파기절차</strong><br />
                    회원님이 회원가입 등을 위해 입력하신 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</p>
                    <p><strong>○ 파기방법</strong><br />
                    전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</p>
                  </div>
                </div>
              </section>

              {/* 개인정보 제공 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보 제공</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
                  <div className="ml-4">
                    <p>- 이용자들이 사전에 동의한 경우</p>
                    <p>- 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</p>
                  </div>
                </div>
              </section>

              {/* 수집한 개인정보의 위탁 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 수집한 개인정보의 위탁</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 서비스 제공 및 향상을 위하여 아래와 같이 개인정보를 위탁하고 있으며, 관계 법령에 따라 위탁계약시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있습니다.</p>
                  <div className="space-y-2">
                    <p><strong>○ 위탁업체 및 위탁업무</strong></p>
                    <div className="ml-4">
                      <p>- CJ대한통운: 상품배송</p>
                      <p>- PG사: 결제, 구매안전서비스 제공등</p>
                      <p>- 본인인증기관: 실명확인, 본인인증</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 이용자 및 법정대리인의 권리 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 이용자 및 법정대리인의 권리와 그 행사방법</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>이용자 및 법정 대리인은 언제든지 등록되어 있는 자신 혹은 당해 만 14세 미만 아동의 개인정보를 조회하거나 수정할 수 있으며 가입해지를 요청할 수도 있습니다.</p>
                  <p>개인정보 조회·수정을 위해서는 '개인정보변경'을, 가입해지(동의철회)를 위해서는 "회원탈퇴"를 클릭하여 본인 확인 절차를 거치신 후 직접 열람, 정정 또는 탈퇴가 가능합니다.</p>
                </div>
              </section>

              {/* 쿠키 관련 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보 자동수집 장치의 설치, 운영 및 그 거부에 관한 사항</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 귀하의 정보를 수시로 저장하고 찾아내는 '쿠키(cookie)' 등을 운용합니다.</p>
                  <div className="space-y-2">
                    <p><strong>▶ 쿠키 등 사용 목적</strong><br />
                    회원과 비회원의 접속 빈도나 방문 시간 등을 분석, 이용자의 취향과 관심분야를 파악 및 자취 추적, 각종 이벤트 참여 정도 및 방문 회수 파악 등을 통한 타겟 마케팅 및 개인 맞춤 서비스 제공</p>
                    <p><strong>▶ 쿠키 설정 거부 방법</strong><br />
                    웹 브라우저 상단의 도구 &gt; 인터넷 옵션 &gt; 개인정보에서 설정 가능합니다. 단, 쿠키 설치를 거부하였을 경우 서비스 제공에 어려움이 있을 수 있습니다.</p>
                  </div>
                </div>
              </section>

              {/* 개인정보 민원서비스 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">■ 개인정보에 관한 민원서비스</h2>
                <div className="space-y-3 text-gray-700 leading-relaxed text-sm">
                  <p>회사는 고객의 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 관련 부서 및 개인정보관리책임자를 지정하고 있습니다.</p>
                  <div className="space-y-2">
                    <p><strong>고객서비스담당 부서:</strong> 루소 고객지원팀<br />
                    <strong>전화번호:</strong> 070-0000-0000<br />
                    <strong>이메일:</strong> support@lusso.com</p>
                    
                    <p><strong>개인정보관리책임자 성명:</strong> 박시온<br />
                    <strong>전화번호:</strong> 070-0000-0000<br />
                    <strong>이메일:</strong> privacy@lusso.com</p>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <p>기타 개인정보침해에 대한 신고나 상담이 필요하신 경우에는 아래 기관에 문의하시기 바랍니다.</p>
                    <p>1. 개인분쟁조정위원회 (www.1336.or.kr/1336)</p>
                    <p>2. 정보보호마크인증위원회 (www.eprivacy.or.kr/02-580-0533~4)</p>
                    <p>3. 대검찰청 인터넷범죄수사센터 (http://icic.sppo.go.kr/02-3480-3600)</p>
                    <p>4. 경찰청 사이버테러대응센터 (www.ctrc.go.kr/02-392-0330)</p>
                  </div>
                </div>
              </section>

              <div className="pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  본 개인정보 취급방침은 2024년 1월 1일부터 시행됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 