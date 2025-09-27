import { getMessage } from '@/i18n/messages'
import { useState } from 'react'

interface Props {
  onClose: () => void
  originalUrl: string
}

export function SmsWelcomeModal({ onClose, originalUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(originalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 max-h-[80vh] overflow-y-auto relative">
        {/* Copy Button */}
        <button
          onClick={handleCopyLink}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <div className="relative">
            {copied ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}

            {/* Copied tooltip */}
            {copied && (
              <div 
                className="absolute -bottom-9 left-1/2 transform -translate-x-1/2 
                           bg-gray-800 text-white text-xs px-2 py-1 rounded 
                           whitespace-nowrap transition-all duration-300 ease-in-out z-10"
                style={{
                  opacity: copied ? 1 : 0,
                  transform: copied ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-4px)'
                }}
              >
                Copied!
                {/* 吹き出しの三角形 */}
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 
                                w-2 h-2 bg-gray-800 rotate-45"></div>
              </div>
            )}
          </div>
        </button>

        <h2 className="text-xl font-bold mb-4 text-center pr-8">
          {getMessage("welcomeToGuestPage")}
        </h2>
        <div className="space-y-3 text-sm">
          <p>{getMessage("smsLinkKeepSafe")}</p>
          
          {/* リンク表示 */}
          <div className="p-3 bg-gray-50 rounded border text-xs break-all font-mono">
            {originalUrl}
          </div>

          <p>{getMessage("smsShareWarning")}</p>
          <p>{getMessage("smsMultiDeviceInfo")}</p>
          <p className="text-red-600">
            <strong>{getMessage("attention")}:</strong> {getMessage("smsExpiryWarning")}
          </p>
          <p>{getMessage("smsSessionRestore")}</p>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          {getMessage("understood")}
        </button>
      </div>
    </div>
  )
}

export default SmsWelcomeModal