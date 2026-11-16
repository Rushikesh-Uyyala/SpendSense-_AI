import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { store } from './store.ts';
import {
  computeBudgetUtilization,
  formatMoneyServer,
  getCurrentMonthKey,
  getDashboardSummary,
  enrichSavingsGoal,
} from './financeService.ts';
import type {
  AIRecommendationPayload,
  FinancialReportRecord,
} from '../shared/types.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_NAME = 'gemini-4-hydrogen';
const STANDARD_DISCLAIMER =
  'Informational guidance generated from your recorded SpendSense AI transactions. This is not certified financial, tax, or investment advice.';

function buildUserFinancialContext(userId: string, month: string) {
  const user = store.db.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');

  const dashboard = getDashboardSummary(userId, month);
  const budgets = computeBudgetUtilization(userId, month);
  const goals = store.db.savingsGoals
    .filter((g) => g.userId === userId)
    .map(enrichSavingsGoal);

  const monthTx = store.db.transactions
    .filter((t) => t.userId === userId && t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Detect repeated titles & potential unusual spikes
  const titleCounts = new Map<string, { count: number; total: number }>();
  for (const t of monthTx) {
    if (t.type !== 'expense') continue;
    const key = t.title.trim();
    const cur = titleCounts.get(key) || { count: 0, total: 0 };
    titleCounts.set(key, { count: cur.count + 1, total: cur.total + t.amount });
  }
  const repeatedExpenses = Array.from(titleCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([title, v]) => ({ title, count: v.count, totalAmount: v.total }));

  // Previous month comparison
  const prevSeries = dashboard.monthlySeries[dashboard.monthlySeries.length - 2];
  const prevMonthExpenses = prevSeries?.expenses ?? 0;
  const momChangePct =
    prevMonthExpenses > 0
      ? Math.round(((dashboard.monthlyExpenses - prevMonthExpenses) / prevMonthExpenses) * 1000) / 10
      : null;

  return {
    userName: user.fullName,
    currency: user.currency,
    month,
    totalBalance: dashboard.totalBalance,
    monthlyIncome: dashboard.monthlyIncome,
    monthlyExpenses: dashboard.monthlyExpenses,
    monthlySavings: dashboard.monthlySavings,
    savingsRatePct: dashboard.savingsRatePct,
    monthlyIncomeTarget: user.monthlyIncomeTarget,
    previousMonthExpenses: prevMonthExpenses,
    monthOverMonthExpenseChangePct: momChangePct,
    expenseByCategory: dashboard.expenseByCategory,
    budgets: budgets.map((b) => ({
      category: b.category,
      limit: b.limitAmount,
      spent: b.spentAmount,
      remaining: b.remainingAmount,
      utilizationPct: b.utilizationPct,
    })),
    sixMonthHistory: dashboard.monthlySeries,
    savingsGoals: goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      remainingAmount: g.remainingAmount,
      targetDate: g.targetDate,
      monthlyContribution: g.monthlyContribution,
      suggestedMonthlySavings: g.suggestedMonthlySavings,
      progressPct: g.progressPct,
    })),
    repeatedExpenses,
    recentTransactionsSample: monthTx.slice(0, 25).map((t) => ({
      date: t.date,
      title: t.title,
      type: t.type,
      category: t.category,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
    })),
  };
}

export async function generateFinancialInsights(
  userId: string,
  monthInput?: string
): Promise<AIRecommendationPayload> {
  const month = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : getCurrentMonthKey();
  const context = buildUserFinancialContext(userId, month);

  if (context.recentTransactionsSample.length === 0 && context.sixMonthHistory.every((m) => m.expenses === 0 && m.income === 0)) {
    const emptyPayload: AIRecommendationPayload = {
      id: crypto.randomUUID(),
      month,
      generatedAt: new Date().toISOString(),
      headline: 'Insufficient financial records for personalized AI analysis.',
      recommendations: [
        {
          title: 'Record your first month of income and daily expenses',
          category: 'General',
          potentialMonthlySavings: 0,
          explanation:
            'There are currently no transactions recorded for your account. Once you add income and expense entries, SpendSense AI will identify spending patterns and realistic savings opportunities.',
          calculationBasis: '0 recorded transactions in database.',
        },
      ],
      behaviorAnalysis: {
        highestSpendingCategory: 'None',
        highestCategoryAmount: 0,
        monthOverMonthChangePct: null,
        repeatedMerchantsOrTitles: [],
        unusualSpikes: [],
        summary: 'Insufficient data: no transactions recorded yet to analyze spending behavior.',
      },
      disclaimer: STANDARD_DISCLAIMER,
    };
    return emptyPayload;
  }

  const ai = getGeminiClient();
  const systemInstruction = `You are SpendSense AI, a grounded personal finance assistant.
STRICT RULES:
1. Never invent, estimate, or hallucinate any transaction, category amount, income, or balance. ONLY cite numbers present in the provided JSON financial context.
2. Clearly explain the exact calculation basis for every recommendation (e.g., "Reducing Food from X to Y saves Z").
3. Give realistic suggestions proportional to the user's actual monthly income (${formatMoneyServer(context.monthlyIncome, context.currency)}).
4. Never promise guaranteed investment returns or recommend risky speculative assets.
5. If historical data is limited (e.g. only 1 month), explicitly mention that limitation.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Analyze this user's real financial database snapshot for ${month} and return personalized recommendations and spending behavior analysis:\n${JSON.stringify(context)}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                potentialMonthlySavings: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
                calculationBasis: { type: Type.STRING },
              },
            },
          },
          behaviorAnalysis: {
            type: Type.OBJECT,
            properties: {
              highestSpendingCategory: { type: Type.STRING },
              highestCategoryAmount: { type: Type.NUMBER },
              monthOverMonthChangePct: { type: Type.NUMBER, nullable: true },
              repeatedMerchantsOrTitles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              unusualSpikes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              summary: { type: Type.STRING },
            },
          },
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
    AIRecommendationPayload,
    'id' | 'month' | 'generatedAt' | 'disclaimer'
  >;

  const topCat = context.expenseByCategory[0];
  const result: AIRecommendationPayload = {
    id: crypto.randomUUID(),
    month,
    generatedAt: new Date().toISOString(),
    headline: parsed.headline || 'Personalized Financial Insights',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
    behaviorAnalysis: {
      highestSpendingCategory: parsed.behaviorAnalysis?.highestSpendingCategory || topCat?.category || 'None',
      highestCategoryAmount: parsed.behaviorAnalysis?.highestCategoryAmount ?? topCat?.amount ?? 0,
      monthOverMonthChangePct: context.monthOverMonthExpenseChangePct,
      repeatedMerchantsOrTitles: Array.isArray(parsed.behaviorAnalysis?.repeatedMerchantsOrTitles)
        ? parsed.behaviorAnalysis.repeatedMerchantsOrTitles
        : context.repeatedExpenses.map((r) => `${r.title} (${r.count}x)`),
      unusualSpikes: Array.isArray(parsed.behaviorAnalysis?.unusualSpikes)
        ? parsed.behaviorAnalysis.unusualSpikes
        : [],
      summary: parsed.behaviorAnalysis?.summary || 'Analysis completed from recorded database transactions.',
    },
    disclaimer: STANDARD_DISCLAIMER,
  };

  store.db.aiRecommendations.unshift({ ...result, userId });
  if (store.db.aiRecommendations.length > 50) {
    store.db.aiRecommendations = store.db.aiRecommendations.slice(0, 50);
  }
  store.save();

  return result;
}

export async function chatWithFinancialAssistant(
  userId: string,
  userMessage: string,
  history: Array<{ role: 'user' | 'model'; text: string }>
): Promise<{ reply: string; disclaimer: string }> {
  const month = getCurrentMonthKey();
  const context = buildUserFinancialContext(userId, month);
  const ai = getGeminiClient();

  const systemInstruction = `You are the SpendSense AI Financial Assistant helping ${context.userName}.
You have read-only access to the user's real PostgreSQL-equivalent financial snapshot below.
Currency: ${context.currency}.
STRICT GUIDELINES:
- Answer directly using ONLY the actual figures from the user's financial snapshot below.
- Never invent transactions, merchants, or balances that are not in the data.
- Whenever suggesting savings or evaluating affordability (e.g., "Can I afford a new phone?"), explicitly show the arithmetic using the user's real monthly income, expenses, current savings, and active savings goals.
- If the user asks about a timeframe or category with zero recorded transactions, clearly state that there is insufficient data.
- Do not promise guaranteed investment returns, and note when appropriate that this is informational guidance rather than certified financial advice.

USER FINANCIAL CONTEXT (${month}):
${JSON.stringify(context)}`;

  const recentHistory = history.slice(-8).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      ...recentHistory,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    config: {
      systemInstruction,
    },
  });

  const reply = response.text?.trim();
  if (!reply) {
    throw new Error('The AI assistant returned an empty response. Please try again.');
  }

  return {
    reply,
    disclaimer: STANDARD_DISCLAIMER,
  };
}

export async function generateMonthlyFinancialReport(
  userId: string,
  monthInput?: string
): Promise<FinancialReportRecord> {
  const month = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : getCurrentMonthKey();
  const context = buildUserFinancialContext(userId, month);
  const ai = getGeminiClient();

  const systemInstruction = `You are SpendSense AI generating an intelligent Monthly Financial Report for ${month}.
STRICT RULES:
- Base every single metric, category total, and budget evaluation strictly on the provided JSON snapshot.
- Never fabricate numbers or transactions.
- Provide clear, constructive, realistic recommendations scaled to the user's recorded income.
- For nextMonthSuggestedBudget, propose practical category limits grounded in this month's actuals and 6-month history.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Generate a structured monthly financial report for ${month} based strictly on this database snapshot:\n${JSON.stringify(context)}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          incomeSummary: { type: Type.STRING },
          expenseSummary: { type: Type.STRING },
          savingsSummary: { type: Type.STRING },
          spendingAnalysis: { type: Type.STRING },
          budgetPerformance: { type: Type.STRING },
          financialMistakes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          nextMonthSuggestedBudget: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                suggestedLimit: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    title?: string;
    incomeSummary?: string;
    expenseSummary?: string;
    savingsSummary?: string;
    spendingAnalysis?: string;
    budgetPerformance?: string;
    financialMistakes?: string[];
    recommendations?: string[];
    nextMonthSuggestedBudget?: Array<{ category: string; suggestedLimit: number; reason: string }>;
  };

  const report: FinancialReportRecord = {
    id: crypto.randomUUID(),
    userId,
    month,
    title: parsed.title || `SpendSense AI Monthly Report — ${month}`,
    sections: {
      incomeSummary: parsed.incomeSummary || `Total recorded income: ${formatMoneyServer(context.monthlyIncome, context.currency)}.`,
      expenseSummary: parsed.expenseSummary || `Total recorded expenses: ${formatMoneyServer(context.monthlyExpenses, context.currency)}.`,
      savingsSummary: parsed.savingsSummary || `Net monthly savings: ${formatMoneyServer(context.monthlySavings, context.currency)} (${context.savingsRatePct}% rate).`,
      spendingAnalysis: parsed.spendingAnalysis || 'No detailed spending analysis available.',
      budgetPerformance: parsed.budgetPerformance || 'Budget utilization summary based on configured monthly limits.',
      financialMistakes: Array.isArray(parsed.financialMistakes) ? parsed.financialMistakes : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      nextMonthSuggestedBudget: Array.isArray(parsed.nextMonthSuggestedBudget) ? parsed.nextMonthSuggestedBudget : [],
    },
    disclaimer: STANDARD_DISCLAIMER,
    createdAt: new Date().toISOString(),
  };

  store.db.financialReports.unshift(report);
  store.save();

  return report;
}
