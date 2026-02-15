export default function Loading({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-10 h-10 border-2 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )
}
