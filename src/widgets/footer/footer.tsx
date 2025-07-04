import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* <div className="flex flex-col md:flex-row justify-between gap-8">
          회사 정보
          <div className="flex-1">
            <h3 className="font-bold text-white mb-4">LUSSO</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>상호 : 루소(LUSSO)</p>
              <p>사업자등록번호: 124-87-60417</p> 
            </div>
          </div>

          {/* 고객센터 */}
          {/* <div className="flex-1">
            <h3 className="font-bold text-white mb-4">고객센터</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>010-2131-7540</p>
              <p>평일 09:00 - 18:00</p>
              <p>주말/공휴일 휴무</p>
              <p>info@russo.co.kr</p>
            </div>
          </div> */}

          {/* 정책 */}
          {/* <div className="flex-1">
            <h3 className="font-bold text-white mb-4">정책</h3>
            <div className="space-y-2 text-sm">
              <Link href="/terms" className="block text-gray-300 hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="block text-gray-300 hover:text-white transition-colors">
                개인정보처리방침
              </Link>
            </div>
          </div> */}
        {/* </div>  */}

        <div className="border-t border-gray-800 py-8 text-center text-sm text-gray-400">
          <p>Copyright © LUSSO All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
} 