import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AccountSelectionToolbarProps {
  selectedCount: number;
  allSelected: boolean;
  disabled?: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  actions?: ReactNode;
}

export function AccountSelectionToolbar({
  selectedCount,
  allSelected,
  disabled = false,
  onToggleSelectAll,
  onClearSelection,
  actions,
}: AccountSelectionToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div className="codex-overview-selection-bar account-selection-toolbar">
      <div className="codex-overview-selection-left">
        <label className="codex-overview-select-all">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={disabled}
            onChange={onToggleSelectAll}
          />
          <span>{t('common.selectAll', '全选')}</span>
        </label>
        {hasSelection && (
          <>
            <span className="codex-overview-selected-count">
              {t('claude.selection.selected', '已选 {{count}}', { count: selectedCount })}
            </span>
            <button
              type="button"
              className="codex-overview-clear-selection-btn"
              onClick={onClearSelection}
            >
              {t('messages.clearSelection', '取消选择')}
            </button>
          </>
        )}
      </div>
      {hasSelection && actions ? (
        <div className="codex-overview-selection-actions">{actions}</div>
      ) : null}
    </div>
  );
}
