export default function EmptyState({ icon = '📭', title = 'لا توجد بيانات', description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <span className="text-5xl mb-4 opacity-80">{icon}</span>
      <p className="font-display font-semibold text-slate-700">{title}</p>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-sm">{description}</p>}
    </div>
  )
}
