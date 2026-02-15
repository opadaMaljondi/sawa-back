export default function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-display font-semibold text-lg text-slate-800">{title}</h2>
        </div>
      )}
      <div className={title ? '' : 'p-6'}>{children}</div>
    </div>
  )
}
