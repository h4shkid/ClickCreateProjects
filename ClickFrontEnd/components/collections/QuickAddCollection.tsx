'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { isValidEthereumAddress } from '@/lib/auth/middleware'
import { useAccount } from 'wagmi'

interface QuickAddCollectionProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (collection: any) => void
}

export default function QuickAddCollection({ isOpen, onClose, onSuccess }: QuickAddCollectionProps) {
  const { isConnected, address } = useAccount()
  const [contractAddress, setContractAddress] = useState('')
  const [chainId, setChainId] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'detecting' | 'success'>('input')
  const [detectedInfo, setDetectedInfo] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contractAddress.trim()) return

    // Validate address
    if (!isValidEthereumAddress(contractAddress)) {
      setError('Please enter a valid Ethereum address')
      return
    }

    setLoading(true)
    setError('')
    setStep('detecting')

    try {
      // Register the contract
      const response = await fetch('/api/contracts/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: contractAddress.trim(),
          chainId,
          walletAddress: address
        })
      })

      const data = await response.json()

      if (data.success && data.data && data.data.contract) {
        setDetectedInfo(data.data.contract)
        setStep('success')
        
        // Auto-close after 2 seconds and call success callback
        setTimeout(() => {
          onSuccess(data.data.contract)
          handleClose()
        }, 2000)
      } else {
        setError(data.error || 'Failed to add collection')
        setStep('input')
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setContractAddress('')
    setChainId(1)
    setError('')
    setStep('input')
    setDetectedInfo(null)
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {step === 'detecting' ? 'Detecting Collection...' : 
             step === 'success' ? 'Collection Added!' : 
             'Add Collection'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isConnected ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Wallet Connection Required</h3>
              <p className="text-muted-foreground mb-4">
                Please connect your wallet to add collections to your account.
              </p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          ) : step === 'input' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contract Address *
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => {
                    setContractAddress(e.target.value)
                    if (error) setError('')
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Blockchain
                </label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
                  disabled={loading}
                >
                  <option value={1}>Ethereum</option>
                  <option value={137}>Polygon</option>
                  <option value={42161}>Arbitrum</option>
                  <option value={8453}>Base</option>
                  <option value={360}>Shape</option>
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-card/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !contractAddress.trim()}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Collection'
                  )}
                </button>
              </div>
            </form>
          )}

          {isConnected && step === 'detecting' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">
                Detecting contract standard and fetching metadata...
              </p>
            </div>
          )}

          {isConnected && step === 'success' && detectedInfo && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{detectedInfo.name}</h3>
              <p className="text-muted-foreground mb-4">
                {detectedInfo.contractType} • {detectedInfo.symbol}
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
                <p className="text-green-400 text-sm">
                  Collection added successfully! Redirecting to snapshot...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}