import { ContractProvider } from '@/lib/contracts/ContractContext'
import { ContractHeader } from '@/components/contracts/ContractHeader'
import { ContractNavigation } from '@/components/contracts/ContractNavigation'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

interface ContractLayoutProps {
  children: React.ReactNode
  params: Promise<{
    address: string
  }>
}

export default async function ContractLayout({ children, params }: ContractLayoutProps) {
  const { address } = await params

  return (
    <ContractProvider address={address}>
      <div className="min-h-screen bg-background">
        {/* Contract Header */}
        <ContractHeader />
        
        {/* Contract Navigation */}
        <ContractNavigation contractAddress={address} />
        
        {/* Page Content */}
        <main className="pb-12">
          <div className="container mx-auto px-6 lg:px-8 pt-6">
            <Breadcrumbs contractAddress={address} />
            {children}
          </div>
        </main>
      </div>
    </ContractProvider>
  )
}