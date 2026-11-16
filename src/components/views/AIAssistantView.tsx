import { useEffect, useState } from 'react';
import {
  FileText,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { apiFetch, formatCurrency, getCurrentMonthStr } from '../../lib/format';
import type {
  AIRecommendationPayload,
  CurrencyCode,
  FinancialReportRecord,
} from '../../shared/types';

interface AIAssistantViewProps {
  currency: CurrencyCode;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  'How much did I spend this month?',
  'Where am I spending the most?',
  'How can I save ₹5,000 monthly?',
  'Am I following my budget?',
  'Which category should I reduce first?',
  'Can I afford a ₹25,000 phone right now?',
];

export function AIAssistantView({ currency }: AIAssistantViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'report'>('chat');
  const [month, setMonth] = useState(getCurrentMonthStr());

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Insights state
  const [insight, setInsight] = useState<AIRecommendationPayload | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // Monthly Report state
  const [reports, setReports] = useState<FinancialReportRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<FinancialReportRecord | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    async function loadExisting() {
      try {
        const [insRes, repRes] = await Promise.all([
          apiFetch<{ insight: AIRecommendationPayload | null }>('/api/ai/insights'),
          apiFetch<{ reports: FinancialReportRecord[] }>('/api/ai/reports'),
        ]);
        setInsight(insRes.insight);
        setReports(repRes.reports);
        if (repRes.reports.length > 0) {
          setSelectedReport(repRes.reports[0]);
        }
      } catch {
        // Non-blocking initial load
      }
    }
    loadExisting();
  }, []);

  async function sendChatMessage(question: string) {
    const trimmed = question.trim();
    if (!trimmed || chatLoading) return;
    setError('');
    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setChatLoading(true);

    try {
      const res = await apiFetch<{ reply: string; disclaimer: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8),
        }),
      });
      setMessages([...nextHistory, { role: 'model', text: res.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI assistant.');
    } finally {
      setChatLoading(false);
    }
  }

  async function handleGenerateInsights() {
    setInsightLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ insight: AIRecommendationPayload }>('/api/ai/insights', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      setInsight(res.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate recommendations.');
    } finally {
      setInsightLoading(false);
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ report: FinancialReportRecord }>('/api/ai/monthly-report', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      setReports((prev) => [res.report, ...prev]);
      setSelectedReport(res.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate monthly report.');
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Financial Assistant
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Grounded strictly in your recorded income, expenses, budgets, and savings goals
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {[
            { id: 'chat', label: 'AI Chat' },
            { id: 'insights', label: 'Recommendations' },
            { id: 'report', label: 'Monthly Report' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as 'chat' | 'insights' | 'report')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* TAB 1: CONVERSATIONAL AI CHAT */}
      {activeTab === 'chat' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[540px]">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
              Quick Questions Using Your Live Records
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendChatMessage(q)}
                  disabled={chatLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[420px]">
            {messages.length === 0 ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2">
                <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Ask anything about your finances
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  SpendSense AI reads your real monthly income, category totals, budget progress, and goal targets before responding with transparent arithmetic.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Analyzing your recorded transactions and budgets...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage(input);
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your spending, savings pace, or budget..."
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={chatLoading || !input.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              AI responses are informational guidance calculated from your SpendSense AI database records, not certified financial advice.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: PERSONALIZED RECOMMENDATIONS & BEHAVIOR ANALYSIS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Analysis Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={insightLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${insightLoading ? 'animate-spin' : ''}`} />
              {insightLoading ? 'Analyzing Financial Records...' : 'Generate Personalized Recommendations'}
            </button>
          </div>

          {!insight ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
              <TrendingUp className="w-8 h-8 text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Click &ldquo;Generate Personalized Recommendations&rdquo; to inspect your spending behavior and saving opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Behavior Analysis */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {insight.headline}
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Month: {insight.month}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {insight.behaviorAnalysis.summary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Highest Spending Category</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                      {insight.behaviorAnalysis.highestSpendingCategory} (
                      <span className="font-mono-num">
                        {formatCurrency(insight.behaviorAnalysis.highestCategoryAmount, currency)}
                      </span>
                      )
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Month-over-Month Change</p>
                    <p className="font-mono-num text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                      {insight.behaviorAnalysis.monthOverMonthChangePct !== null
                        ? `${insight.behaviorAnalysis.monthOverMonthChangePct > 0 ? '+' : ''}${insight.behaviorAnalysis.monthOverMonthChangePct}%`
                        : 'Insufficient prior month data'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Repeated Expenses</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                      {insight.behaviorAnalysis.repeatedMerchantsOrTitles.length > 0
                        ? insight.behaviorAnalysis.repeatedMerchantsOrTitles.join(', ')
                        : 'None detected'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insight.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {rec.category}
                        </p>
                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                          {rec.title}
                        </h3>
                      </div>
                      {rec.potentialMonthlySavings > 0 && (
                        <span className="font-mono-num text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          Save {formatCurrency(rec.potentialMonthlySavings, currency)}/mo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {rec.explanation}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                      Calculation basis: {rec.calculationBasis}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">{insight.disclaimer}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI MONTHLY FINANCIAL REPORT */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Report Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              {reports.length > 0 && (
                <select
                  value={selectedReport?.id || ''}
                  onChange={(e) => {
                    const found = reports.find((r) => r.id === e.target.value);
                    if (found) setSelectedReport(found);
                  }}
                  aria-label="Select saved report"
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.createdAt.slice(0, 10)})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5" />
              {reportLoading ? 'Compiling Monthly Report...' : 'Generate AI Monthly Report'}
            </button>
          </div>

          {!selectedReport ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
              <FileText className="w-8 h-8 text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                No AI monthly reports generated yet. Select a month and generate your first comprehensive review.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generated {selectedReport.createdAt.slice(0, 10)} &middot; Period {selectedReport.month}
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {selectedReport.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Income Summary</h3>
                  <p className="text-sm text-slate-800 dark:text-slate-200 mt-1.5 leading-relaxed">
                    {selectedReport.sections.incomeSummary}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Expense Summary</h3>
                  <p className="text-sm text-slate-800 dark:text-slate-200 mt-1.5 leading-relaxed">
                    {selectedReport.sections.expenseSummary}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Savings Summary</h3>
                  <p className="text-sm text-slate-800 dark:text-slate-200 mt-1.5 leading-relaxed">
                    {selectedReport.sections.savingsSummary}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Spending Analysis
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedReport.sections.spendingAnalysis}
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Budget Performance
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedReport.sections.budgetPerformance}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Areas Needing Attention
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {selectedReport.sections.financialMistakes.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Actionable Recommendations
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {selectedReport.sections.recommendations.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {selectedReport.sections.nextMonthSuggestedBudget.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Next Month&apos;s Suggested Category Budgets
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                          <th className="py-2 pr-4">Category</th>
                          <th className="py-2 pr-4 text-right">Suggested Limit</th>
                          <th className="py-2">Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {selectedReport.sections.nextMonthSuggestedBudget.map((b, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                              {b.category}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                              {formatCurrency(b.suggestedLimit, currency)}
                            </td>
                            <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">{b.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                {selectedReport.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
