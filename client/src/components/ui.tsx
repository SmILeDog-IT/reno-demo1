import type { ReactNode } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { fmt } from '../api';

export function PageHeader({
  title,
  period,
  onPeriodChange,
  extra,
  subtitle,
}: {
  title: string;
  period?: string;
  onPeriodChange?: (value: string) => void;
  extra?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="page-titlebar">
      <div className="page-title-wrap">
        <div className="page-title">{title}</div>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      <div className="page-tools">
        {period && onPeriodChange ? (
          <DatePicker
            picker="month"
            allowClear={false}
            size="small"
            value={dayjs(period)}
            format="YYYY年第MM期"
            onChange={(v) => v && onPeriodChange(v.format('YYYY-MM'))}
          />
        ) : null}
        {extra}
      </div>
    </div>
  );
}

export function Money({ value, bold, className = '' }: { value: number; bold?: boolean; className?: string }) {
  return (
    <span className={`money ${value < 0 ? 'money-neg' : ''} ${bold ? 'money-bold' : ''} ${className}`}>
      {fmt(value)}
    </span>
  );
}

export function Ratio({ value }: { value: number }) {
  return <span className={value < 0 ? 'ratio-neg' : value > 0 ? 'ratio-pos' : ''}>{value.toFixed(2)}%</span>;
}

export const EMPTY_TEXT = '暂无数据';
