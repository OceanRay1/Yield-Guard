import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  // Logs the actual runtime error to your browser dev console (F12)
  console.error("ErrorBoundary caught an error:", error)

  const errorMessage = error instanceof Error ? error.message : String(error)

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-gray-200 p-6">
      <div className="max-w-md rounded-lg bg-gray-900 p-6 border border-gray-800 shadow-xl text-center">
        <h2 className="text-lg font-semibold text-red-400">UI Glitch Detected</h2>
        <p className="text-sm text-gray-400 mt-2 mb-3">
          Avoid any rapid clicking which may cause a temporary data mismatch.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)