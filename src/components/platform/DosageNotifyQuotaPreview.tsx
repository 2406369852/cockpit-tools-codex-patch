import type { DosageNotifyUsage } from './DosageNotifyUsageStatus';

interface DosageNotifyQuotaPreviewProps {
  usage: DosageNotifyUsage;
  locale: string;
  emptyText: string;
  normalText: string;
  abnormalText: string;
  abnormalDisplay?: 'detail' | 'short';
}

function resolveDosageNotifyDetailText(usage: DosageNotifyUsage, locale: string): string {
  const detailRaw = locale.startsWith('zh')
    ? (usage.dosageNotifyZh || usage.dosageNotifyCode)
    : (usage.dosageNotifyEn || usage.dosageNotifyCode);
  return (detailRaw || usage.dosageNotifyCode || '').trim();
}

export function DosageNotifyQuotaPreview({
  usage,
  locale,
  emptyText,
  normalText,
  abnormalText,
  abnormalDisplay = 'detail',
}: DosageNotifyQuotaPreviewProps) {
  if (!usage.dosageNotifyCode) {
    return <span className="account-quota-empty">{emptyText}</span>;
  }

  if (usage.isNormal) {
    return (
      <div className="account-quota-preview">
        <span className="account-quota-item">
          <span className="quota-dot high" />
          <span className="quota-text high">{normalText}</span>
        </span>
      </div>
    );
  }

  const detailText = resolveDosageNotifyDetailText(usage, locale);
  const displayText = abnormalDisplay === 'detail'
    ? (detailText || abnormalText)
    : abnormalText;
  const titleText = detailText || undefined;

  return (
    <div className="account-quota-preview">
      <span className="account-quota-item">
        <span className="quota-dot critical" />
        <span className="quota-text critical" title={titleText}>{displayText}</span>
      </span>
    </div>
  );
}
