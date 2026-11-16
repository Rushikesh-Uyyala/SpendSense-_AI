import { useState } from 'react';
import type { CurrencyCode } from '../../shared/types';
import { AnalyticsView } from './AnalyticsView';
import { ForecastingView } from './ForecastingView';
import { RecurringView } from './RecurringView';

interface ReportsViewProps {
  currency: CurrencyCode;
  dark: boolean;
  onDataChanged: () => void;
}

type ReportSection = 'analytics' | 'forecasting' | 'recurring';

export function ReportsView({ currency, dark, onDataChanged }: ReportsViewProps) {
  const [section, setSection] = useState<ReportSection>('analytics');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-[#059669] dark:text-emerald-400">
            Financial Intelligence &amp; Reporting
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between historical analytics, statistical cash flow forecasting, and automated recurring schedules
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'analytics', label: 'Analytics & CSV' },
              { id: 'forecasting', label: 'Forecasting' },
              { id: 'recurring', label: 'Recurring Schedules' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                section === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'analytics' && <AnalyticsView currency={currency} dark={dark} />}
      {section === 'forecasting' && <ForecastingView currency={currency} dark={dark} />}
      {section === 'recurring' && <RecurringView currency={currency} onDataChanged={onDataChanged} />}
    </div>
  );
}
