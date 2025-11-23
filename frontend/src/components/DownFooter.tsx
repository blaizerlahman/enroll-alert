export default function DownFooter({ message }: { message?: string }) {
  return (
    <footer
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 bg-yellow-400 text-yellow-900 border-t border-yellow-600 py-3 px-4 flex items-center justify-center rounded-lg"
    >
      <div className="max-w-7xl w-full text-sm text-center">
        {message ?? 'EnrollAlert is currently down. We are working to restore functionality soon.'}
      </div>
    </footer>
  )
}
