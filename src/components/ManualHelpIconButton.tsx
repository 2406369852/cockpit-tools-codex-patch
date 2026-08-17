import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ManualHelpIconButtonProps {
  className: string;
  onClick?: () => void;
  iconSize?: number;
}

function openManualPage() {
  window.dispatchEvent(new CustomEvent('app-request-navigate', { detail: 'manual' }));
}

export function ManualHelpIconButton({
  className,
  onClick,
  iconSize = 16,
}: ManualHelpIconButtonProps) {
  const { t } = useTranslation();
  const manualTitle = t('manual.navTitle', '功能使用手册');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick ?? openManualPage}
      title={manualTitle}
      aria-label={manualTitle}
    >
      <HelpCircle size={iconSize} />
    </button>
  );
}
