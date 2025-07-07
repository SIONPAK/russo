import { headers } from 'next/headers'

export function getBaseUrl() {
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  return `${protocol}://${host}`
} 