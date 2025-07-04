import { NoticeDetailPage } from '@/pages/community/notice-detail-page'

export default function NoticeDetail({ params }: { params: { id: string } }) {
  return <NoticeDetailPage noticeId={params.id} />
} 