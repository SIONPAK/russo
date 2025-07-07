import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const templatePath = path.join(process.cwd(), 'public/templates/루소_영수증.xlsx')
    const templateBuffer = fs.readFileSync(templatePath)
    
    return new NextResponse(templateBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template.xlsx"'
      }
    })
  } catch (error) {
    console.error('템플릿 파일 로드 중 오류 발생:', error)
    return new NextResponse('템플릿 파일을 불러올 수 없습니다.', { status: 500 })
  }
} 