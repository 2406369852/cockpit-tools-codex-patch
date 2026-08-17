import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, RefreshCw } from 'lucide-react';

interface CodebuddySessionFileEntry {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number | null;
}

/**
 * CodeBuddy local session file manager (#1188): list and open local session files.
 */
export function CodebuddySessionListPanel() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CodebuddySessionFileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await invoke<CodebuddySessionFileEntry[]>(
        'codebuddy_list_local_session_files',
        { limit: 200 },
      );
      setItems(list ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openPath = async (path: string) => {
    try {
      const parent = path.replace(/[/\\][^/\\]+$/, '');
      await invoke('open_local_path', { path: parent || path });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="settings-group" style={{ marginTop: 16 }}>
      <div className="group-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t('codebuddy.sessions.title', '本机会话文件')}</span>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void reload()}>
          <RefreshCw size={14} />
          {t('common.refresh', '刷新')}
        </button>
      </div>
      <p className="row-desc">
        {t(
          'codebuddy.sessions.desc',
          '扫描本机 CodeBuddy 数据目录中的会话相关 JSON/JSONL 文件，可打开所在位置。',
        )}
      </p>
      {error ? <div className="modal-error-message">{error}</div> : null}
      {items.length === 0 ? (
        <div className="qs-hint">{t('codebuddy.sessions.empty', '未找到会话文件')}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.path}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{item.name}</strong>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{item.path}</code>
                <div className="qs-hint">
                  {(item.sizeBytes / 1024).toFixed(1)} KB
                  {item.modifiedAt
                    ? ` · ${new Date(item.modifiedAt * 1000).toLocaleString()}`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void openPath(item.path)}
                title={t('codebuddy.sessions.open', '打开位置')}
              >
                <FolderOpen size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
