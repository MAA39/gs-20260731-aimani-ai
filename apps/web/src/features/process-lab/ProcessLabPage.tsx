import { ArrowLeft, FlaskConical, RefreshCw } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProcessStepStatus } from '@aimani-ai/contracts';
import { updateProcessStepStatus } from './process-lab.functions';
import { processLabKey } from './process-lab-query-key';
import type { ProcessLabResult } from './process-lab-schema';
import { MobileProcessList } from './MobileProcessList';
import { ProcessCanvas } from './ProcessCanvas';

export function ProcessLabPage({
  organizationId,
  result,
  retry,
}: {
  organizationId: string;
  result: ProcessLabResult;
  retry: () => void;
}) {
  const queryClient = useQueryClient();
  const [mobileError, setMobileError] = useState('');
  const mobileMutation = useMutation({ mutationFn: updateProcessStepStatus });

  if (result.status !== 'ok') {
    return (
      <section className="content">
        <div className="empty-surface">
          <h2>{result.status === 'forbidden' ? 'この組織では閲覧できません' : result.status === 'not_found' ? '工程が見つかりません' : '工程を読み込めませんでした'}</h2>
          <p>{result.error.message}</p>
          <button className="secondary-button" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />再試行</button>
          <Link className="secondary-button" to="/$organizationId/work" params={{ organizationId }}>Team Workへ戻る</Link>
        </div>
      </section>
    );
  }

  const { workspace } = result;

  async function changeMobileStatus(stepId: string, status: ProcessStepStatus) {
    setMobileError('');
    let next: ProcessLabResult;
    try {
      next = await mobileMutation.mutateAsync({ data: { organizationId, stepId, status } });
    } catch {
      setMobileError('工程を保存できませんでした。時間をおいてもう一度お試しください。');
      return;
    }
    if (next.status !== 'ok') {
      setMobileError(next.error.message);
      return;
    }
    queryClient.setQueryData(processLabKey(organizationId), next);
  }

  return (
    <section className="content process-lab-page">
      <Link className="back-link" to="/$organizationId/work" params={{ organizationId }}><ArrowLeft size={17} aria-hidden="true" />Team Workへ戻る</Link>
      <header className="process-lab-header">
        <div>
          <div className="process-lab-badge"><FlaskConical size={14} aria-hidden="true" />実験機能</div>
          <p className="eyebrow">PROCESS LAB · {workspace.board.name}</p>
          <h2>仕事のつながりを、触って確かめる</h2>
          <p>誰の工程が、次の誰を待たせているか。線をたどりながらチームの流れを確認できます。</p>
        </div>
        <div className="process-lab-legend" aria-label="工程の凡例">
          <span><i className="is-progress" />進行中</span>
          <span><i className="is-waiting" />待機中</span>
          <span><i className="is-completed" />完了</span>
        </div>
      </header>
      <div className="process-desktop-only">
        <ProcessCanvas key={workspace.board.revision} organizationId={organizationId} workspace={workspace} />
      </div>
      <div className="process-mobile-only">
        {mobileError ? <p className="process-mobile-error" role="alert">{mobileError}</p> : null}
        <MobileProcessList workspace={workspace} busy={mobileMutation.isPending} onStatusChange={(stepId, status) => { void changeMobileStatus(stepId, status); }} />
      </div>
    </section>
  );
}
