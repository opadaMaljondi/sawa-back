export default function Placeholder({ title, description = 'هذه الصفحة قيد التطوير.' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-4xl mb-6">
        📄
      </div>
      <h1 className="font-display font-bold text-2xl text-slate-800">{title}</h1>
      <p className="text-slate-500 mt-2 max-w-md">{description}</p>
    </div>
  )
}
