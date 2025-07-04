'use client'

import { MainLayout } from '@/widgets/layout/main-layout'

export function TermsPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-8">
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">이용약관</h1>
                <p className="text-gray-600 mb-8 text-sm">
                  루소 도매 플랫폼 이용약관입니다. 서비스 이용 전 반드시 확인해주세요.
                </p>
              </div>

              {/* 제1조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제1조(목적)</h2>
                <p className="text-gray-700 leading-relaxed text-sm">
                  이 약관은 루소 회사(전자상거래 사업자)가 운영하는 루소 사이버 몰(이하 "몰"이라 한다)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 한다)를 이용함에 있어 사이버 몰과 이용자의 권리,의무 및 책임사항을 규정함을 목적으로 합니다.<br />
                  ※「PC통신, 무선 등을 이용하는 전자상거래에 대해서도 그 성질에 반하지 않는 한 이 약관을 준용합니다.」
                </p>
              </section>

              {/* 제2조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제2조(정의)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>① "몰"이란 루소 회사가 재화 또는 용역(이하 "재화 등"이라 함)을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 아울러 사이버몰을 운영하는 사업자의 의미로도 사용합니다.</p>
                  <p>② "이용자"란 "몰"에 접속하여 이 약관에 따라 "몰"이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</p>
                  <p>③ '회원'이라 함은 "몰"에 회원등록을 한 자로서, 계속적으로 "몰"이 제공하는 서비스를 이용할 수 있는 자를 말합니다.</p>
                  <p>④ '비회원'이라 함은 회원에 가입하지 않고 "몰"이 제공하는 서비스를 이용하는 자를 말합니다.</p>
                </div>
              </section>

              {/* 제3조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제3조 (약관 등의 명시와 설명 및 개정)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>① "몰"은 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지 주소(소비자의 불만을 처리할 수 있는 곳의 주소를 포함), 전화번호,모사전송번호,전자우편주소, 사업자등록번호, 통신판매업 신고번호, 개인정보관리책임자등을 이용자가 쉽게 알 수 있도록 루소 사이버몰의 초기 서비스화면(전면)에 게시합니다.</p>
                  <p>② "몰은 이용자가 약관에 동의하기에 앞서 약관에 정하여져 있는 내용 중 청약철회.배송책임.환불조건 등과 같은 중요한 내용을 이용자가 이해할 수 있도록 별도의 연결화면 또는 팝업화면 등을 제공하여 이용자의 확인을 구하여야 합니다.</p>
                  <p>③ "몰"은 관련 법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</p>
                </div>
              </section>

              {/* 제4조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제4조(서비스의 제공 및 변경)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>① "몰"은 다음과 같은 업무를 수행합니다.</p>
                  <div className="ml-4">
                    <p>1. 재화 또는 용역에 대한 정보 제공 및 구매계약의 체결</p>
                    <p>2. 구매계약이 체결된 재화 또는 용역의 배송</p>
                    <p>3. 기타 "몰"이 정하는 업무</p>
                  </div>
                  <p>② "몰"은 재화 또는 용역의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할 재화 또는 용역의 내용을 변경할 수 있습니다.</p>
                </div>
              </section>

              {/* 제6조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제6조(회원가입)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>① 이용자는 "몰"이 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.</p>
                  <p>② "몰"은 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.</p>
                  <div className="ml-4">
                    <p>1. 등록 내용에 허위, 기재누락, 오기가 있는 경우</p>
                    <p>2. 기타 회원으로 등록하는 것이 "몰"의 기술상 현저히 지장이 있다고 판단되는 경우</p>
                  </div>
                </div>
              </section>

              {/* 제11조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제11조(지급방법)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>"몰"에서 구매한 재화 또는 용역에 대한 대금지급방법은 다음 각 호의 방법중 가용한 방법으로 할 수 있습니다.</p>
                  <div className="ml-4">
                    <p>1. 폰뱅킹, 인터넷뱅킹, 메일 뱅킹 등의 각종 계좌이체</p>
                    <p>2. 선불카드, 직불카드, 신용카드 등의 각종 카드 결제</p>
                    <p>3. 온라인무통장입금</p>
                    <p>4. 마일리지 등 "몰"이 지급한 포인트에 의한 결제</p>
                  </div>
                </div>
              </section>

              {/* 제17조 */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">제17조(개인정보보호)</h2>
                <div className="space-y-2 text-gray-700 leading-relaxed text-sm">
                  <p>① "몰"은 이용자의 개인정보 수집시 서비스제공을 위하여 필요한 범위에서 최소한의 개인정보를 수집합니다.</p>
                  <p>② "몰"은 이용자의 개인정보를 수집?이용하는 때에는 당해 이용자에게 그 목적을 고지하고 동의를 받습니다.</p>
                  <p>③ "몰"은 개인정보 보호를 위하여 이용자의 개인정보를 취급하는 자를 최소한으로 제한하여야 하며 개인정보의 분실, 도난, 유출 등으로 인한 이용자의 손해에 대하여 모든 책임을 집니다.</p>
                </div>
              </section>

              <div className="pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  본 약관은 2024년 1월 1일부터 시행됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 