export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-background text-textPrimary">
      {children}
    </div>
  )
}
