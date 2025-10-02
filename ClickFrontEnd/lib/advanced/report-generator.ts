import { getDatabase } from '../database/init';
import { AnalyticsEngine } from './analytics-engine';
import { MerkleGenerator } from './merkle-generator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReportOptions {
  format: 'html' | 'pdf' | 'markdown' | 'json';
  includeCharts?: boolean;
  includeMetadata?: boolean;
  customBranding?: {
    logo?: string;
    companyName?: string;
    website?: string;
  };
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  summary: {
    totalHolders: number;
    totalSupply: string;
    uniqueTokens: number;
    totalTransfers: number;
  };
  analytics: any;
  distribution: any[];
  topHolders: any[];
  merkleTree?: any;
}

export class ReportGenerator {
  private db;
  private analytics: AnalyticsEngine;
  private merkleGenerator: MerkleGenerator;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
    this.analytics = new AnalyticsEngine();
    this.merkleGenerator = new MerkleGenerator();
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(
    title: string,
    options: ReportOptions
  ): Promise<string> {
    console.log(`📊 Generating ${options.format.toUpperCase()} report...`);

    // Collect report data
    const reportData = await this.collectReportData(title);

    // Generate report based on format
    let content: string;
    switch (options.format) {
      case 'html':
        content = await this.generateHTMLReport(reportData, options);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(reportData, options);
        break;
      case 'json':
        content = JSON.stringify(reportData, null, 2);
        break;
      case 'pdf':
        content = await this.generatePDFReport(reportData, options);
        break;
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    // Save report
    const filename = await this.saveReport(content, options.format);
    console.log(`✅ Report generated: ${filename}`);

    return filename;
  }

  /**
   * Collect all report data
   */
  private async collectReportData(title: string): Promise<ReportData> {
    // Get summary statistics
    const summary = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT address) as total_holders,
        SUM(CAST(balance AS INTEGER)) as total_supply,
        COUNT(DISTINCT token_id) as unique_tokens
      FROM current_state
      WHERE balance > 0
    `).get() as any;

    const transfers = this.db.prepare(`
      SELECT COUNT(*) as total_transfers FROM events
    `).get() as any;

    // Get analytics
    const networkMetrics = await this.analytics.getNetworkMetrics();
    const liquidityMetrics = await this.analytics.getLiquidityMetrics();

    // Get distribution data
    const distribution = this.db.prepare(`
      SELECT 
        CASE 
          WHEN CAST(balance AS INTEGER) = 1 THEN '1'
          WHEN CAST(balance AS INTEGER) BETWEEN 2 AND 5 THEN '2-5'
          WHEN CAST(balance AS INTEGER) BETWEEN 6 AND 10 THEN '6-10'
          WHEN CAST(balance AS INTEGER) BETWEEN 11 AND 50 THEN '11-50'
          WHEN CAST(balance AS INTEGER) BETWEEN 51 AND 100 THEN '51-100'
          ELSE '100+'
        END as range,
        COUNT(*) as holders,
        SUM(CAST(balance AS INTEGER)) as total_balance
      FROM current_state
      WHERE balance > 0
      GROUP BY range
      ORDER BY MIN(CAST(balance AS INTEGER))
    `).all() as any[];

    // Get top holders
    const topHolders = this.db.prepare(`
      SELECT 
        address,
        SUM(CAST(balance AS INTEGER)) as total_balance,
        COUNT(DISTINCT token_id) as unique_tokens
      FROM current_state
      WHERE balance > 0
      GROUP BY address
      ORDER BY total_balance DESC
      LIMIT 20
    `).all() as any[];

    return {
      title,
      generatedAt: new Date(),
      summary: {
        totalHolders: summary.total_holders,
        totalSupply: summary.total_supply?.toString() || '0',
        uniqueTokens: summary.unique_tokens,
        totalTransfers: transfers.total_transfers
      },
      analytics: {
        network: networkMetrics,
        liquidity: liquidityMetrics
      },
      distribution,
      topHolders
    };
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    data: ReportData,
    options: ReportOptions
  ): Promise<string> {
    const charts = options.includeCharts ? this.generateChartScript(data) : '';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} - NFT Snapshot Report</title>
    <style>
        :root {
            --primary: #ff6b35;
            --background: #0a0a0a;
            --card-bg: #1a1a1a;
            --text: #ffffff;
            --text-muted: #888888;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: var(--background);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid #333;
        }
        
        h1 {
            font-size: 2.5rem;
            background: linear-gradient(135deg, var(--primary), #ff8c42);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1rem;
        }
        
        .timestamp {
            color: var(--text-muted);
            font-size: 0.9rem;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        
        .stat-card {
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid #333;
        }
        
        .stat-label {
            color: var(--text-muted);
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: var(--primary);
        }
        
        .section {
            margin-bottom: 3rem;
        }
        
        .section-title {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            color: var(--primary);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
        }
        
        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #333;
        }
        
        th {
            background: #222;
            color: var(--primary);
            font-weight: 600;
        }
        
        tr:hover {
            background: #222;
        }
        
        .chart-container {
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            height: 400px;
        }
        
        .footer {
            text-align: center;
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid #333;
            color: var(--text-muted);
        }
        
        ${options.customBranding ? `
        .branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .branding img {
            height: 40px;
        }
        ` : ''}
    </style>
    ${charts}
</head>
<body>
    <div class="container">
        <div class="header">
            ${options.customBranding ? `
            <div class="branding">
                ${options.customBranding.logo ? `<img src="${options.customBranding.logo}" alt="Logo">` : ''}
                ${options.customBranding.companyName ? `<h2>${options.customBranding.companyName}</h2>` : ''}
            </div>
            ` : ''}
            <h1>${data.title}</h1>
            <div class="timestamp">Generated on ${data.generatedAt.toLocaleString()}</div>
        </div>
        
        <div class="summary-grid">
            <div class="stat-card">
                <div class="stat-label">Total Holders</div>
                <div class="stat-value">${data.summary.totalHolders.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Supply</div>
                <div class="stat-value">${Number(data.summary.totalSupply).toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique Tokens</div>
                <div class="stat-value">${data.summary.uniqueTokens.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Transfers</div>
                <div class="stat-value">${data.summary.totalTransfers.toLocaleString()}</div>
            </div>
        </div>
        
        ${options.includeCharts ? `
        <div class="section">
            <h2 class="section-title">Distribution Analysis</h2>
            <div class="chart-container">
                <canvas id="distributionChart"></canvas>
            </div>
        </div>
        ` : ''}
        
        <div class="section">
            <h2 class="section-title">Token Distribution</h2>
            <table>
                <thead>
                    <tr>
                        <th>Balance Range</th>
                        <th>Holders</th>
                        <th>Total Balance</th>
                        <th>% of Holders</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.distribution.map(d => `
                    <tr>
                        <td>${d.range}</td>
                        <td>${d.holders.toLocaleString()}</td>
                        <td>${d.total_balance.toLocaleString()}</td>
                        <td>${((d.holders / data.summary.totalHolders) * 100).toFixed(2)}%</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2 class="section-title">Top 20 Holders</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Address</th>
                        <th>Balance</th>
                        <th>Unique Tokens</th>
                        <th>% of Supply</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topHolders.map((h, i) => `
                    <tr>
                        <td>#${i + 1}</td>
                        <td>${h.address.substring(0, 6)}...${h.address.substring(38)}</td>
                        <td>${h.total_balance.toLocaleString()}</td>
                        <td>${h.unique_tokens}</td>
                        <td>${((h.total_balance / Number(data.summary.totalSupply)) * 100).toFixed(2)}%</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${options.includeMetadata ? `
        <div class="section">
            <h2 class="section-title">Network Analytics</h2>
            <div class="summary-grid">
                <div class="stat-card">
                    <div class="stat-label">Active Addresses (24h)</div>
                    <div class="stat-value">${data.analytics.network.activeAddresses24h}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">New Addresses (24h)</div>
                    <div class="stat-value">${data.analytics.network.newAddresses24h}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Liquidity Score</div>
                    <div class="stat-value">${data.analytics.liquidity.liquidityScore}/100</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Transfer Size</div>
                    <div class="stat-value">${data.analytics.network.averageTransferSize}</div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Generated by NFT Snapshot Tool</p>
            ${options.customBranding?.website ? `<p><a href="${options.customBranding.website}" style="color: var(--primary);">${options.customBranding.website}</a></p>` : ''}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(
    data: ReportData,
    options: ReportOptions
  ): string {
    return `# ${data.title}

*Generated on ${data.generatedAt.toLocaleString()}*

## Summary

| Metric | Value |
|--------|-------|
| Total Holders | ${data.summary.totalHolders.toLocaleString()} |
| Total Supply | ${Number(data.summary.totalSupply).toLocaleString()} |
| Unique Tokens | ${data.summary.uniqueTokens.toLocaleString()} |
| Total Transfers | ${data.summary.totalTransfers.toLocaleString()} |

## Token Distribution

| Balance Range | Holders | Total Balance | % of Holders |
|---------------|---------|---------------|--------------|
${data.distribution.map(d => 
  `| ${d.range} | ${d.holders.toLocaleString()} | ${d.total_balance.toLocaleString()} | ${((d.holders / data.summary.totalHolders) * 100).toFixed(2)}% |`
).join('\n')}

## Top 20 Holders

| Rank | Address | Balance | Unique Tokens | % of Supply |
|------|---------|---------|---------------|-------------|
${data.topHolders.map((h, i) => 
  `| #${i + 1} | ${h.address.substring(0, 6)}...${h.address.substring(38)} | ${h.total_balance.toLocaleString()} | ${h.unique_tokens} | ${((h.total_balance / Number(data.summary.totalSupply)) * 100).toFixed(2)}% |`
).join('\n')}

${options.includeMetadata ? `
## Network Analytics

- **Active Addresses (24h):** ${data.analytics.network.activeAddresses24h}
- **New Addresses (24h):** ${data.analytics.network.newAddresses24h}
- **Peak Activity Hour:** ${data.analytics.network.peakActivityHour}:00
- **Peak Activity Day:** ${data.analytics.network.peakActivityDay}

## Liquidity Metrics

- **Liquidity Score:** ${data.analytics.liquidity.liquidityScore}/100
- **Volume to Supply Ratio:** ${data.analytics.liquidity.volumeToSupplyRatio.toFixed(4)}
- **Unique Traders Ratio:** ${data.analytics.liquidity.uniqueTradersRatio.toFixed(4)}
- **Average Trade Size:** ${data.analytics.liquidity.averageTradeSize}
` : ''}

---
*Generated by NFT Snapshot Tool*
${options.customBranding?.website ? `*[${options.customBranding.website}](${options.customBranding.website})*` : ''}`;
  }

  /**
   * Generate PDF report (returns HTML for PDF conversion)
   */
  private async generatePDFReport(
    data: ReportData,
    options: ReportOptions
  ): Promise<string> {
    // For PDF, we return HTML optimized for print
    const html = await this.generateHTMLReport(data, options);
    
    // Add print-specific styles
    return html.replace('</style>', `
        @media print {
            body {
                padding: 0;
                background: white;
                color: black;
            }
            
            .stat-card, table {
                background: white;
                border: 1px solid #ddd;
            }
            
            .stat-value {
                color: #ff6b35;
            }
            
            .page-break {
                page-break-after: always;
            }
        }
    </style>`);
  }

  /**
   * Generate chart script
   */
  private generateChartScript(data: ReportData): string {
    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('distributionChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(data.distribution.map(d => d.range))},
                        datasets: [{
                            label: 'Number of Holders',
                            data: ${JSON.stringify(data.distribution.map(d => d.holders))},
                            backgroundColor: '#ff6b35',
                            borderColor: '#ff8c42',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: '#333'
                                },
                                ticks: {
                                    color: '#888'
                                }
                            },
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    color: '#888'
                                }
                            }
                        }
                    }
                });
            }
        });
    </script>`;
  }

  /**
   * Save report to file
   */
  private async saveReport(content: string, format: string): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report-${timestamp}.${format}`;
    const filepath = path.join(reportsDir, filename);
    
    await fs.writeFile(filepath, content, 'utf-8');
    
    return filepath;
  }

  /**
   * Generate airdrop allocation report
   */
  async generateAirdropReport(
    recipients: Array<{ address: string; amount: string }>,
    totalAmount: string
  ): Promise<string> {
    const merkleData = await this.merkleGenerator.generateMerkleTree(recipients, {
      sortByAmount: true
    });
    
    const report = {
      title: 'Airdrop Allocation Report',
      generatedAt: new Date(),
      merkleRoot: merkleData.root,
      totalRecipients: recipients.length,
      totalAmount,
      averageAllocation: (BigInt(totalAmount) / BigInt(recipients.length)).toString(),
      distribution: this.analyzeDistribution(recipients),
      topRecipients: recipients.slice(0, 100),
      gasEstimate: merkleData.leaves.length * 50000 // Rough estimate
    };
    
    return JSON.stringify(report, null, 2);
  }

  /**
   * Analyze distribution
   */
  private analyzeDistribution(recipients: Array<{ address: string; amount: string }>): any {
    const amounts = recipients.map(r => BigInt(r.amount));
    const sorted = [...amounts].sort((a, b) => a > b ? 1 : -1);
    
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / BigInt(2)
      : sorted[Math.floor(sorted.length / 2)];
    
    const sum = amounts.reduce((a, b) => a + b, BigInt(0));
    const mean = sum / BigInt(amounts.length);
    
    // Calculate standard deviation
    const squaredDiffs = amounts.map(a => {
      const diff = a - mean;
      return diff * diff;
    });
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, BigInt(0)) / BigInt(amounts.length);
    
    return {
      min: sorted[0].toString(),
      max: sorted[sorted.length - 1].toString(),
      median: median.toString(),
      mean: mean.toString(),
      standardDeviation: avgSquaredDiff.toString()
    };
  }
}