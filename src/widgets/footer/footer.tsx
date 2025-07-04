import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-black text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          {/* 회사 정보 */}
          <div className="flex-1">
            <h3 className="font-bold text-white mb-4">LUSSO</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>상호 : 루소(LUSSO)</p>
              <p>대표 : 박시온</p>
              <p>대표전화 : 070-0000-0000</p>
              <p>주소 : 충청남도 천안시 서북구 월봉7길 26, 102호(쌍용동, 푸른들SFC)</p>
              <p>사업자등록번호: 124-87-60417</p> 
              <p>통신판매업신고: 2025-충남-0001</p>
              <p>이메일 : info@lusso.co.kr</p>
            </div>
          </div>

          {/* 고객센터 */}
          <div className="flex-1">
            <h3 className="font-bold text-white mb-4">고객센터</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>070-1234-5678</p>
              <p>평일 09:00 - 18:00</p>
              <p>주말/공휴일 휴무</p>
              {/* <p>info@russo.co.kr</p> */}
            </div>
          </div>

          {/* 정책 */}
          <div className="flex-1">
            <h3 className="font-bold text-white mb-4">정책</h3>
            <div className="space-y-2 text-sm">
              <Link href="/terms" className="block text-gray-300 hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="block text-gray-300 hover:text-white transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/business" className="block text-gray-300 hover:text-white transition-colors">
                사업자 정보
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>Copyright © LUSSO All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
} 