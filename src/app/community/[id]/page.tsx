import { NoticeDetailPage } from "@/page-components/community/notice-detail-page"

export default async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NoticeDetailPage noticeId={id} />
}
