import { AdminLayout } from '@/widgets/admin/layout/admin-layout'

export default function AdminLayoutRoute({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
} 