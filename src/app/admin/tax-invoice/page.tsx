"use client";

import { useState, useEffect } from "react";
import { FaFileInvoice, FaDownload, FaEdit, FaSave, FaTimes, FaFileExcel, FaSearch, FaChevronLeft, FaChevronRight, FaCheck, FaClock, FaExclamationTriangle } from "react-icons/fa";
import * as XLSX from 'xlsx';

interface CompanySummary {
  businessName: string;
  totalDeduction: number;
  actualSupplyAmount: number;
  estimatedVat: number;
  totalWithVat: number;
  recordCount: number;
  latestDeductionDate: string | null;
  memberInfo: {
    ceoName: string;
    businessNumber: string;
    businessAddress: string;
    businessType: string;
    businessCategory: string;
    tel: string;
    email: string;
  } | null;
  is_issued: string; // 발행 상태: 'O', '△', 'X'
  issuedAt: string | null;
  issuedBy: string | null;
}

interface AdminSummary {
  yearMonth: string;
  period: {
    startDate: string;
    endDate: string;
  };
  results: CompanySummary[];
  summary: {
    totalCompanies: number;
    grandTotal: {
      totalDeduction: number;
      actualSupplyAmount: number;
      estimatedVat: number;
      totalWithVat: number;
    };
  };
}

export default function AdminTaxInvoicePage() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  
  // 검색 및 페이지네이션 상태
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filteredResults, setFilteredResults] = useState<CompanySummary[]>([]);
  
  // 일괄 변경 상태
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([]);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // 현재 월을 기본값으로 설정
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);
  }, []);

  // 데이터 조회
  const fetchData = async () => {
    if (!selectedMonth) return;

    setLoading(true);
    setError(null);

    try {
      const url = `/api/admin/tax-invoice?yearMonth=${selectedMonth}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setFilteredResults(result.data.results || []);
        setCurrentPage(1);
      } else {
        setError(result.error || '데이터 조회에 실패했습니다.');
      }
    } catch (err) {
      console.error('데이터 조회 오류:', err);
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      fetchData();
    }
  }, [selectedMonth]);

  // 검색 필터링
  useEffect(() => {
    if (!data) return;
    
    let filtered = data.results;
    
    // 업체명으로 검색
    if (searchTerm.trim()) {
      filtered = filtered.filter(item => 
        item.businessName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredResults(filtered);
    setCurrentPage(1);
    setSelectedBusinesses([]);
  }, [data, searchTerm]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = filteredResults.slice(startIndex, endIndex);

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 페이지 크기 변경
  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // 엑셀 다운로드
  const downloadExcel = async () => {
    if (!data) return;

    try {
      const excelData = data.results.map((item, index) => ({
        '번호': index + 1,
        '업체명': item.businessName,
        '대표자': item.memberInfo?.ceoName || '',
        '사업자번호': item.memberInfo?.businessNumber || '',
        '사업장주소': item.memberInfo?.businessAddress || '',
        '업태': item.memberInfo?.businessType || '',
        '종목': item.memberInfo?.businessCategory || '',
        '전화번호': item.memberInfo?.tel || '',
        '이메일': item.memberInfo?.email || '',
        '실제_공급가액': item.actualSupplyAmount,
        '부가세': item.estimatedVat,
        '부가세포함': item.totalWithVat,
        '차감건수': item.recordCount,
        '최근_차감일': item.latestDeductionDate ? new Date(item.latestDeductionDate).toLocaleDateString('ko-KR') : '',
        '발행상태': item.is_issued === 'O' ? '완료' : item.is_issued === '△' ? '진행중' : '미발행'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const wscols = [
        { wch: 8 },  // 번호
        { wch: 20 }, // 업체명
        { wch: 10 }, // 대표자
        { wch: 15 }, // 사업자번호
        { wch: 30 }, // 사업장주소
        { wch: 15 }, // 업태
        { wch: 15 }, // 종목
        { wch: 15 }, // 전화번호
        { wch: 25 }, // 이메일
        { wch: 15 }, // 실제_공급가액
        { wch: 15 }, // 부가세
        { wch: 15 }, // 부가세포함
        { wch: 10 }, // 차감건수
        { wch: 12 }, // 최근_차감일
        { wch: 12 }  // 발행상태
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, '세금계산서');

      const fileName = `세금계산서_${data.yearMonth}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const handleIssueStatusChange = async (businessName: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin/tax-invoice/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          yearMonth: selectedMonth,
          status: newStatus
        })
      });

      const result = await response.json();
      if (result.success) {
        await fetchData();
      } else {
        alert(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleSelectBusiness = (businessName: string, checked: boolean) => {
    if (checked) {
      setSelectedBusinesses([...selectedBusinesses, businessName]);
    } else {
      setSelectedBusinesses(selectedBusinesses.filter(name => name !== businessName));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedBusinesses.length === 0) {
      alert('먼저 업체를 선택해주세요.');
      return;
    }

    const statusText = newStatus === 'O' ? '완료' : newStatus === '△' ? '진행중' : '미발행';
    const confirmed = confirm(`선택한 ${selectedBusinesses.length}개 업체의 발행상태를 '${statusText}'로 변경하시겠습니까?`);
    
    if (!confirmed) return;

    setIsUpdatingBulk(true);

    try {
      const response = await fetch('/api/admin/tax-invoice/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessNames: selectedBusinesses,
          yearMonth: selectedMonth,
          status: newStatus
        })
      });

      const result = await response.json();
      if (result.success) {
        await fetchData();
        setSelectedBusinesses([]);
        alert(`${result.data.successCount}개 업체의 상태가 변경되었습니다.`);
      } else {
        alert(result.error || '일괄 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 상태 변경 오류:', error);
      alert('일괄 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FaFileInvoice className="mr-3 text-blue-500" />
            세금계산서 관리
          </h1>
          <p className="text-gray-600 mt-2">
            업체별 차감 마일리지 내역 및 세금계산서 발행 상태를 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
            disabled={loading}
          >
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg border border-red-300">
          {error}
        </div>
      )}

      {/* 데이터 표시 */}
      {data && (
        <>
          {/* 총계 카드 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {data.yearMonth} 월별 총계
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={downloadExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <FaFileExcel className="mr-2" />
                  엑셀 다운로드
                </button>
                
                {/* 전체 선택 및 일괄 발행상태 변경 버튼들 */}
                <div className="flex gap-2 border-l border-gray-300 pl-2 ml-2">
                  <button
                    onClick={() => setSelectedBusinesses(filteredResults.map(item => item.businessName))}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-2 rounded-lg flex items-center text-sm"
                  >
                    전체선택
                  </button>
                  <button
                    onClick={() => setSelectedBusinesses([])}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-2 rounded-lg flex items-center text-sm"
                  >
                    선택해제
                  </button>
                  
                  <div className="border-l border-gray-400 mx-1"></div>
                  
                  <button
                    onClick={() => handleBulkStatusChange('X')}
                    disabled={isUpdatingBulk}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg flex items-center disabled:opacity-50 text-sm"
                  >
                    <FaExclamationTriangle className="mr-1" />
                    일괄 미발행
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('△')}
                    disabled={isUpdatingBulk}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg flex items-center disabled:opacity-50 text-sm"
                  >
                    <FaClock className="mr-1" />
                    일괄 진행중
                  </button>
                  <button
                    onClick={() => handleBulkStatusChange('O')}
                    disabled={isUpdatingBulk}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center disabled:opacity-50 text-sm"
                  >
                    <FaCheck className="mr-1" />
                    일괄 완료
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">총 업체 수</p>
                <p className="text-2xl font-bold text-gray-700">{data.summary.totalCompanies}개</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">총 공급가액</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(data.summary.grandTotal.actualSupplyAmount)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">총 부가세</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(data.summary.grandTotal.estimatedVat)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">총 부가세 포함</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(data.summary.grandTotal.actualSupplyAmount + data.summary.grandTotal.estimatedVat)}
                </p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-indigo-600 font-medium">차감 건수 총합</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {data.results.reduce((sum, item) => sum + item.recordCount, 0)}건
                </p>
              </div>
            </div>
          </div>

          {/* 검색 및 필터링 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="업체명으로 검색..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-64"
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={10}>10개씩 보기</option>
                  <option value={20}>20개씩 보기</option>
                  <option value={50}>50개씩 보기</option>
                  <option value={100}>100개씩 보기</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                {searchTerm ? (
                  <>
                    <span className="font-medium text-blue-600">"{searchTerm}"</span> 검색 결과: 
                    <span className="font-medium"> {filteredResults.length}개</span> / 전체 {data?.results.length}개
                  </>
                ) : (
                  <>전체 <span className="font-medium">{data?.results.length}개</span> 업체</>
                )}
              </div>
            </div>

            {/* 업체 목록 테이블 */}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedBusinesses.length === currentResults.length && currentResults.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBusinesses([...new Set([...selectedBusinesses, ...currentResults.map(item => item.businessName)])]);
                          } else {
                            setSelectedBusinesses(selectedBusinesses.filter(name => !currentResults.map(item => item.businessName).includes(name)));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left">업체명</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">공급가액</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">부가세</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">부가세포함</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">차감건수</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">최근차감일</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">발행상태</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResults.map((item, index) => (
                    <tr key={item.businessName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedBusinesses.includes(item.businessName)}
                          onChange={(e) => handleSelectBusiness(item.businessName, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 font-medium">{item.businessName}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.actualSupplyAmount)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.estimatedVat)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.totalWithVat)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{item.recordCount}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{formatDate(item.latestDeductionDate)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <select
                          value={item.is_issued}
                          onChange={(e) => handleIssueStatusChange(item.businessName, e.target.value)}
                          className={`px-2 py-1 rounded text-sm font-medium ${
                            item.is_issued === 'O' ? 'bg-green-100 text-green-800' :
                            item.is_issued === '△' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}
                        >
                          <option value="X">미발행</option>
                          <option value="△">진행중</option>
                          <option value="O">완료</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                >
                  <FaChevronLeft />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded ${
                      currentPage === page
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 