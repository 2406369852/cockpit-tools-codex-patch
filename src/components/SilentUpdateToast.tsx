import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './SilentUpdateToast.css';

interface SilentUpdateToastProps {
  version: string;
  onRestart: () => void;
  onDismiss: () => void;
}

export const SilentUpdateToast: React.FC<SilentUpdateToastProps> = ({
  version,
  onRestart,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <div className="silent-update-toast">
      <div className="silent-update-toast-content">
        <span className="silent-update-toast-text">
          {t('update_notification.silentReady', 'v{{version}} is ready. Restart to apply.', { version })}
        </span>
        <div className="silent-update-toast-actions">
          <button className="silent-update-btn-later" onClick={onDismiss}>
            {t('update_notification.later', 'Later')}
          </button>
          <button className="silent-update-btn-restart" onClick={onRestart}>
            <RefreshCw size={14} />
            {t('update_notification.restartNow', 'Restart')}
          </button>
        </div>
      </div>
      <button className="silent-update-toast-close" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
};
