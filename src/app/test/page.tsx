'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export default function TestPage() {
  const [registerData, setRegisterData] = useState({
    email: 'test@example.com',
    password: 'test123!@#',
    companyName: '테스트 회사',
    businessNumber: '123-45-67890',
    representativeName: '홍길동',
    phone: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    postalCode: '12345',
    recipientName: '홍길동',
    recipientPhone: '010-1234-5678'
  })

  const [loginData, setLoginData] = useState({
    email: 'test@example.com',
    password: 'test123!@#',
    userType: 'customer' as 'admin' | 'customer'
  })

  const [adminLoginData, setAdminLoginData] = useState({
    email: 'admin',
    password: 'admin123!',
    userType: 'admin' as 'admin' | 'customer'
  })

  const [results, setResults] = useState<any[]>([])

  const addResult = (title: string, data: any) => {
    setResults(prev => [...prev, { title, data, timestamp: new Date().toLocaleTimeString() }])
  }

  const testRegister = async () => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      })
      const result = await response.json()
      addResult('회원가입 테스트', result)
    } catch (error) {
      addResult('회원가입 테스트 (오류)', error)
    }
  }

  const testLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })
      const result = await response.json()
      addResult('고객 로그인 테스트', result)
    } catch (error) {
      addResult('고객 로그인 테스트 (오류)', error)
    }
  }

  const testAdminLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLoginData)
      })
      const result = await response.json()
      addResult('관리자 로그인 테스트', result)
    } catch (error) {
      addResult('관리자 로그인 테스트 (오류)', error)
    }
  }

  const createAdmin = async () => {
    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      addResult('관리자 계정 생성', result)
    } catch (error) {
      addResult('관리자 계정 생성 (오류)', error)
    }
  }

  const checkAdmins = async () => {
    try {
      const response = await fetch('/api/admin/info', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      addResult('관리자 계정 조회', result)
    } catch (error) {
      addResult('관리자 계정 조회 (오류)', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">API 테스트 페이지</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 테스트 컨트롤 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">1. 관리자 계정 관리</h2>
              <p className="text-sm text-gray-600 mb-4">
                테스트용 관리자 계정을 생성하거나 조회합니다.<br/>
                아이디: admin, 비밀번호: admin123!
              </p>
              <div className="space-y-2">
                <Button onClick={createAdmin} className="w-full">
                  관리자 계정 생성
                </Button>
                <Button onClick={checkAdmins} variant="outline" className="w-full">
                  관리자 계정 조회
                </Button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">2. 회원가입 테스트</h2>
              <div className="space-y-3">
                <Input
                  placeholder="이메일"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="비밀번호"
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Input
                  placeholder="회사명"
                  value={registerData.companyName}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, companyName: e.target.value }))}
                />
                <Button onClick={testRegister} className="w-full">
                  회원가입 테스트
                </Button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">3. 고객 로그인 테스트</h2>
              <div className="space-y-3">
                <Input
                  placeholder="이메일"
                  value={loginData.email}
                  onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="비밀번호"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button onClick={testLogin} className="w-full">
                  고객 로그인 테스트
                </Button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">4. 관리자 로그인 테스트</h2>
              <div className="space-y-3">
                <Input
                  placeholder="아이디"
                  value={adminLoginData.email}
                  onChange={(e) => setAdminLoginData(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="비밀번호"
                  type="password"
                  value={adminLoginData.password}
                  onChange={(e) => setAdminLoginData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button onClick={testAdminLogin} className="w-full">
                  관리자 로그인 테스트
                </Button>
              </div>
            </div>
          </div>

          {/* 결과 표시 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">테스트 결과</h2>
              <Button 
                variant="outline" 
                onClick={() => setResults([])}
                className="text-sm"
              >
                결과 지우기
              </Button>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-gray-500 text-center py-8">테스트 결과가 여기에 표시됩니다.</p>
              ) : (
                results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{result.title}</h3>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 