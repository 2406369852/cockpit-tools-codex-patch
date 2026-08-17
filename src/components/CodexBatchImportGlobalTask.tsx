import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, FileText, X } from 'lucide-react';
import {
  selectPrimaryJob,
  useCodexBatchImportTaskStore,
  type CodexBatchImportJob,
} from '../stores/useCodexBatchImportTaskStore';

interface CodexBatchImportGlobalTaskProps {
  onOpenCodex: () => void;
}

export function CodexBatchImportGlobalTask({ onOpenCodex }: CodexBatchImportGlobalTaskProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  // Select stable map reference — never return a new array from the selector
  // (that triggers useSyncExternalStore infinite loops).
  const jobsMap = useCodexBatchImportTaskStore((s) => s.jobs);
  const requestReopen = useCodexBatchImportTaskStore((s) => s.requestReopen);
  const clearJob = useCodexBatchImportTaskStore((s) => s.clear);
  const primary = useCodexBatchImportTaskStore(selectPrimaryJob);

  const jobs = useMemo(
    () => Object.values(jobsMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [jobsMap],
  );
  const visible = useMemo(
    () => jobs.filter((j) => !j.open),
    [jobs],
  );
  const displayed = showAll ? visible : visible.slice(0, 3);

  useEffect(() => {
    if (visible.length <= 3 && showAll) {
      setShowAll(false);
    }
  }, [showAll, visible.length]);

  const getJobStatusText = (job: CodexBatchImportJob) => {
    if (job.hasResult) {
      return job.phase === 'cancelled'
        ? t('codex.batchImport.cancelled', '已取消')
        : t('codex.batchImport.imported', '已导入');
    }
    if (job.busy) {
      if (job.phase === 'queued') {
        return t('codex.batchImport.queued', '排队中');
      }
      return t('codex.batchImport.taskRunning', {
        defaultValue: '进行中 {{current}}/{{total}}',
        current: job.current,
        total: job.total,
      });
    }
    if (job.phase === 'error') {
      return t('codex.batchImport.failed', '失败');
    }
    if (job.phase === 'cancelled') {
      return t('codex.batchImport.cancelled', '已取消');
    }
    if (job.hasPreview && job.checkQuota && job.phase === 'ready') {
      return t(
        'codex.batchImport.scanCompleteReview',
        '扫描完成，请查看',
      );
    }
    if (job.hasPreview) {
      return t('codex.batchImport.taskPreview', {
        defaultValue: '待确认，共 {{total}} 条',
        total: job.total,
      });
    }
    return t('codex.batchImport.preparing', '准备中…');
  };

  if (visible.length === 0) return null;

  return (
    <div className="codex-batch-import-global-stack">
      <div
        className={
          showAll
            ? 'codex-batch-import-global-list is-expanded'
            : 'codex-batch-import-global-list'
        }
      >
        {displayed.map((job, index) => (
          <div
            key={job.taskId}
            className={`codex-batch-import-global-task ${
              !job.busy &&
              job.hasPreview &&
              !job.hasResult &&
              job.phase === 'ready'
                ? 'needs-review'
                : ''
            }`}
            role="status"
          >
            <div className="codex-batch-import-global-task__copy">
              <strong>
                {t('codex.batchImport.hiddenTask', '批量导入任务')}
                {visible.length > 1 ? ` · ${index + 1}` : ''}
              </strong>
              <span>{getJobStatusText(job)}</span>
              <div className="codex-batch-import-global-task__progress">
                <div
                  style={{
                    width: `${
                      job.total > 0
                        ? Math.min(
                            100,
                            Math.round((job.current / job.total) * 100),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="codex-batch-import-global-task__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  requestReopen(job.taskId);
                  onOpenCodex();
                }}
              >
                <FileText size={14} />
                <span>{t('codex.batchImport.reopen', '查看任务')}</span>
              </button>
              {!job.busy && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => clearJob(job.taskId)}
                  title={t('codex.batchImport.dismissTask', '丢弃任务')}
                >
                  <X size={14} />
                  <span>{t('codex.batchImport.dismissTask', '丢弃')}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {primary && visible.length > 3 ? (
        <button
          type="button"
          className="btn btn-secondary codex-batch-import-global-more"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {showAll
            ? t('codex.batchImport.collapseTasks', '收起任务')
            : t('codex.batchImport.viewAllTasks', {
                defaultValue: '查看全部 {{count}} 个任务',
                count: visible.length,
              })}
        </button>
      ) : null}
    </div>
  );
}
