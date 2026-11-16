import { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import type { CurrencyCode } from '../shared/types';
import { formatCurrency } from '../lib/format';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
);

const CATEGORY_COLORS = [
  '#2563EB',
  '#0F172A',
  '#16A34A',
  '#F59E0B',
  '#7C3AED',
  '#0284C7',
  '#DC2626',
  '#64748B',
  '#0D9488',
  '#D97706',
];

function useChartInstance(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  buildConfig: () => ChartConfiguration,
  deps: unknown[]
) {
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }
    const config = buildConfig();
    chartRef.current = new Chart(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function IncomeVsExpenseChart({
  series,
  currency,
  dark,
}: {
  series: Array<{ label: string; income: number; expenses: number }>;
  currency: CurrencyCode;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridColor = dark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.05)';
  const tickColor = dark ? '#94A3B8' : '#64748B';
  const expenseColor = dark ? '#64748B' : '#0F172A';

  useChartInstance(
    canvasRef,
    () => ({
      type: 'bar',
      data: {
        labels: series.map((s) => s.label),
        datasets: [
          {
            label: 'Income',
            data: series.map((s) => s.income),
            backgroundColor: '#059669',
            borderRadius: 5,
            barPercentage: 0.68,
            categoryPercentage: 0.56,
          },
          {
            label: 'Expenses',
            data: series.map((s) => s.expenses),
            backgroundColor: expenseColor,
            borderRadius: 5,
            barPercentage: 0.68,
            categoryPercentage: 0.56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            align: 'start',
            labels: {
              color: tickColor,
              boxWidth: 10,
              boxHeight: 10,
              padding: 16,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw || 0), currency)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: gridColor },
            ticks: {
              display: false,
            },
          },
        },
      },
    }),
    [series, currency, dark]
  );

  return <canvas ref={canvasRef} />;
}

export function CategoryDoughnutChart({
  items,
  currency,
  dark,
}: {
  items: Array<{ category: string; amount: number }>;
  currency: CurrencyCode;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickColor = dark ? '#CBD5E1' : '#334155';

  useChartInstance(
    canvasRef,
    () => ({
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.category),
        datasets: [
          {
            data: items.map((i) => i.amount),
            backgroundColor: items.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]),
            borderWidth: 2,
            borderColor: dark ? '#0F172A' : '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: tickColor,
              boxWidth: 10,
              boxHeight: 10,
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatCurrency(Number(ctx.raw || 0), currency)}`,
            },
          },
        },
      },
    }),
    [items, currency, dark]
  );

  return <canvas ref={canvasRef} />;
}

export function WeeklySpendingChart({
  weeks,
  currency,
  dark,
}: {
  weeks: Array<{ label: string; amount: number }>;
  currency: CurrencyCode;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridColor = dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)';
  const tickColor = dark ? '#94A3B8' : '#64748B';

  useChartInstance(
    canvasRef,
    () => ({
      type: 'bar',
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [
          {
            label: 'Weekly Spending',
            data: weeks.map((w) => w.amount),
            backgroundColor: '#7C3AED',
            borderRadius: 6,
            barThickness: 28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => formatCurrency(Number(ctx.raw || 0), currency),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (v) => formatCurrency(Number(v), currency),
            },
          },
        },
      },
    }),
    [weeks, currency, dark]
  );

  return <canvas ref={canvasRef} />;
}

export function SavingsTrendChart({
  series,
  currency,
  dark,
}: {
  series: Array<{ label: string; savings: number }>;
  currency: CurrencyCode;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridColor = dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)';
  const tickColor = dark ? '#94A3B8' : '#64748B';

  useChartInstance(
    canvasRef,
    () => ({
      type: 'line',
      data: {
        labels: series.map((s) => s.label),
        datasets: [
          {
            label: 'Net Savings',
            data: series.map((s) => s.savings),
            borderColor: '#16A34A',
            backgroundColor: 'rgba(22, 163, 74, 0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#16A34A',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Net Savings: ${formatCurrency(Number(ctx.raw || 0), currency)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (v) => formatCurrency(Number(v), currency),
            },
          },
        },
      },
    }),
    [series, currency, dark]
  );

  return <canvas ref={canvasRef} />;
}

export function ForecastChart({
  history,
  projectedExpense,
  projectedIncome,
  currency,
  dark,
}: {
  history: Array<{ label: string; income: number; expenses: number }>;
  projectedExpense: number;
  projectedIncome: number;
  currency: CurrencyCode;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridColor = dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)';
  const tickColor = dark ? '#94A3B8' : '#64748B';

  const labels = [...history.map((h) => h.label), 'Next Month (Est.)'];
  const expData = [...history.map((h) => h.expenses), projectedExpense];
  const incData = [...history.map((h) => h.income), projectedIncome];

  useChartInstance(
    canvasRef,
    () => ({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incData,
            borderColor: '#16A34A',
            backgroundColor: 'rgba(22, 163, 74, 0.08)',
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 4,
            segment: {
              borderDash: (ctx) => (ctx.p1DataIndex === labels.length - 1 ? [6, 4] : undefined),
            },
          },
          {
            label: 'Expenses',
            data: expData,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.10)',
            fill: true,
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 4,
            segment: {
              borderDash: (ctx) => (ctx.p1DataIndex === labels.length - 1 ? [6, 4] : undefined),
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: tickColor, boxWidth: 10, boxHeight: 10, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw || 0), currency)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (v) => formatCurrency(Number(v), currency),
            },
          },
        },
      },
    }),
    [history, projectedExpense, projectedIncome, currency, dark]
  );

  return <canvas ref={canvasRef} />;
}
