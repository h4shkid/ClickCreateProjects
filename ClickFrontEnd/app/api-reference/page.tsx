import { Metadata } from 'next'
import { Code2, Lock, Zap, Database, GitBranch, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Reference - ClickCreate',
  description: 'Complete API documentation for ClickCreate platform',
}

const endpoints = [
  {
    method: 'GET',
    path: '/api/contracts',
    description: 'List all available NFT contracts',
    auth: 'Optional',
    params: [
      { name: 'page', type: 'number', description: 'Page number for pagination' },
      { name: 'limit', type: 'number', description: 'Results per page (max: 100)' },
      { name: 'chain_id', type: 'number', description: 'Filter by blockchain' },
    ],
    response: `{
  "success": true,
  "data": {
    "contracts": [...],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}`
  },
  {
    method: 'POST',
    path: '/api/contracts/register',
    description: 'Add a new NFT collection',
    auth: 'Required',
    params: [
      { name: 'contractAddress', type: 'string', description: 'Contract address (0x...)' },
      { name: 'chainId', type: 'number', description: 'Blockchain ID (1 for Ethereum)' },
      { name: 'walletAddress', type: 'string', description: 'Your wallet address' },
    ],
    response: `{
  "success": true,
  "countsAsNewSync": true,
  "data": {
    "contract": {...},
    "syncStatus": {...}
  }
}`
  },
  {
    method: 'GET',
    path: '/api/contracts/[address]/holders',
    description: 'Get current holder list for a collection',
    auth: 'Optional',
    params: [
      { name: 'min_balance', type: 'number', description: 'Minimum token balance' },
      { name: 'format', type: 'string', description: 'json | csv' },
    ],
    response: `{
  "success": true,
  "data": {
    "holders": [...],
    "totalHolders": 1234,
    "totalSupply": "10000"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/contracts/[address]/snapshot/current',
    description: 'Generate current state snapshot',
    auth: 'Required',
    params: [
      { name: 'includeMetadata', type: 'boolean', description: 'Include token metadata' },
      { name: 'format', type: 'string', description: 'Export format' },
    ],
    response: `{
  "success": true,
  "data": {
    "snapshotId": "...",
    "totalHolders": 1234,
    "downloadUrl": "..."
  }
}`
  },
  {
    method: 'GET',
    path: '/api/user/sync-stats',
    description: 'Get your daily sync quota status',
    auth: 'Required',
    params: [],
    response: `{
  "success": true,
  "data": {
    "dailySyncsToday": 1,
    "maxDailySyncs": 2,
    "availableToday": 1,
    "resetTime": "2025-11-02T00:00:00.000Z"
  }
}`
  },
]

export default function APIReferencePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Code2 className="h-4 w-4" />
              API Reference
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Build with{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ClickCreate API
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              RESTful API for accessing NFT analytics, holder data, and snapshot generation programmatically.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Quick Info Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-16">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-semibold">Base URL</h3>
            <code className="text-sm text-muted-foreground break-all">
              https://clickcreate.xyz/api
            </code>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-semibold">Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Pass wallet address in header:<br />
              <code className="text-xs">x-wallet-address</code>
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-semibold">Rate Limits</h3>
            <p className="text-sm text-muted-foreground">
              10 requests/hour for write operations<br />
              Unlimited read operations
            </p>
          </div>
        </div>

        {/* Important Notice */}
        <div className="mb-12 rounded-lg border border-orange-500/20 bg-orange-500/10 p-6">
          <div className="flex gap-4">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-orange-500" />
            <div>
              <h3 className="mb-2 font-semibold text-orange-500">Beta API Notice</h3>
              <p className="text-sm text-muted-foreground">
                The ClickCreate API is currently in beta. Endpoints may change without notice.
                We recommend checking this documentation regularly for updates.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-8">
          <div className="mb-8">
            <h2 className="mb-4 text-3xl font-bold">API Endpoints</h2>
            <p className="text-muted-foreground">
              All endpoints return JSON responses with a consistent structure.
            </p>
          </div>

          {endpoints.map((endpoint, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className={`px-3 py-1 rounded-md text-xs font-mono font-semibold ${
                    endpoint.method === 'GET'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm font-mono">{endpoint.path}</code>
                  <span className={`ml-auto px-2 py-1 rounded text-xs ${
                    endpoint.auth === 'Required'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {endpoint.auth === 'Required' ? '🔒 Auth Required' : '🔓 Optional Auth'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {endpoint.description}
                </p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Parameters */}
                {endpoint.params.length > 0 && (
                  <div>
                    <h4 className="mb-3 font-semibold">Parameters</h4>
                    <div className="space-y-2">
                      {endpoint.params.map((param, pIndex) => (
                        <div key={pIndex} className="flex gap-4 text-sm">
                          <code className="font-mono text-primary min-w-[140px]">
                            {param.name}
                          </code>
                          <span className="text-muted-foreground min-w-[60px]">
                            {param.type}
                          </span>
                          <span className="text-muted-foreground">
                            {param.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Example */}
                <div>
                  <h4 className="mb-3 font-semibold">Example Response</h4>
                  <pre className="rounded-md bg-muted/50 p-4 overflow-x-auto">
                    <code className="text-xs font-mono text-muted-foreground">
                      {endpoint.response}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SDK Coming Soon */}
        <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="mb-4 text-2xl font-bold">JavaScript SDK Coming Soon</h2>
          <p className="mb-6 text-muted-foreground max-w-2xl mx-auto">
            We're working on an official JavaScript/TypeScript SDK to make integration even easier.
            Subscribe to our newsletter to get notified when it launches.
          </p>
          <button className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90">
            Notify Me
          </button>
        </div>
      </div>
    </div>
  )
}
