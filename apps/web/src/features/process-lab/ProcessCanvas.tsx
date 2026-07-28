import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProcessLabWorkspace, ProcessStepStatus } from '@amidala/contracts';
import {
  connectProcessSteps,
  disconnectProcessSteps,
  moveProcessStep,
  updateProcessStepStatus,
} from './process-lab.functions';
import { processLabKey } from './process-lab-query-key';
import type { ProcessLabResult } from './process-lab-schema';
import {
  canConnectProcessSteps,
  orderProcessSteps,
  toFlowEdges,
  toFlowNodes,
} from './process-lab-presenter';
import { ProcessInspector } from './ProcessInspector';
import { ProcessStepNode } from './ProcessStepNode';

const nodeTypes = { processStep: ProcessStepNode };

export function ProcessCanvas({
  organizationId,
  workspace,
}: {
  organizationId: string;
  workspace: ProcessLabWorkspace;
}) {
  const firstStepId = orderProcessSteps(workspace)[0]?.stepId ?? null;
  const [selectedStepId, setSelectedStepId] = useState<string | null>(firstStepId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(workspace, firstStepId),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(workspace, firstStepId),
  );
  const [mutationError, setMutationError] = useState('');
  const [retryOperation, setRetryOperation] = useState<(() => void) | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (operation: () => Promise<ProcessLabResult>) => operation(),
  });

  const selectedDependency = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId)
    : undefined;
  const availability = nodes.find((node) => node.id === selectedStepId)?.data
    .availability ?? null;

  function selectStep(stepId: string | null) {
    setSelectedStepId(stepId);
    setSelectedEdgeId(null);
    setNodes(toFlowNodes(workspace, stepId));
    setEdges(toFlowEdges(workspace, stepId));
  }

  async function run(operation: () => Promise<ProcessLabResult>) {
    setMutationError('');
    setRetryOperation(null);
    let result: ProcessLabResult;
    try {
      result = await mutation.mutateAsync(operation);
    } catch {
      setMutationError('保存できませんでした。接続を確認してもう一度お試しください。');
      setRetryOperation(() => () => { void run(operation); });
      return;
    }
    if (result.status !== 'ok') {
      setMutationError(result.error.message);
      setRetryOperation(() => () => { void run(operation); });
      return;
    }
    queryClient.setQueryData(processLabKey(organizationId), result);
  }

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    selectStep(node.id);
  };

  const handleEdgeClick: EdgeMouseHandler = (_event, edge) => {
    setSelectedStepId(null);
    setSelectedEdgeId(edge.id);
    setNodes(toFlowNodes(workspace, null));
    setEdges(
      toFlowEdges(workspace, null).map((candidate) => ({
        ...candidate,
        selected: candidate.id === edge.id,
      })),
    );
  };

  function connect(connection: Connection) {
    if (!canConnectProcessSteps(workspace, connection.source, connection.target)) {
      setMutationError('循環または重複になるため、この工程同士はつなげません。');
      return;
    }
    void run(() =>
      connectProcessSteps({
        data: {
          organizationId,
          predecessorStepId: connection.source!,
          successorStepId: connection.target!,
        },
      }),
    );
  }

  function changeStatus(status: ProcessStepStatus) {
    if (!selectedStepId) return;
    void run(() =>
      updateProcessStepStatus({
        data: { organizationId, stepId: selectedStepId, status },
      }),
    );
  }

  function disconnect() {
    if (!selectedDependency) return;
    void run(() =>
      disconnectProcessSteps({
        data: {
          organizationId,
          predecessorStepId: selectedDependency.source,
          successorStepId: selectedDependency.target,
        },
      }),
    );
  }

  return (
    <div className="process-workspace-grid">
      <div className="process-canvas" aria-label="工程のつながりを編集">
        <div className="process-canvas-help">
          工程を選ぶと責任の経路を強調します。端の丸をドラッグして工程をつなげます。
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={() => selectStep(null)}
          onConnect={connect}
          onNodeDragStop={(_event, node) => {
            void run(() =>
              moveProcessStep({
                data: {
                  organizationId,
                  stepId: node.id,
                  x: node.position.x,
                  y: node.position.y,
                },
              }),
            );
          }}
          isValidConnection={(connection) =>
            canConnectProcessSteps(workspace, connection.source, connection.target)
          }
          nodesDraggable={!mutation.isPending}
          nodesConnectable={!mutation.isPending}
          nodesFocusable
          edgesFocusable
          fitView
          fitViewOptions={{ padding: 0.14, minZoom: 0.35, maxZoom: 1 }}
          minZoom={0.35}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
          aria-label="工程の依存関係キャンバス"
          ariaLabelConfig={{
            'node.a11yDescription.default': 'Enterキーで選択できます。',
            'edge.a11yDescription.default': '工程同士の依存関係です。',
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>
      <ProcessInspector
        workspace={workspace}
        selectedStepId={selectedStepId}
        selectedDependency={selectedDependency ? { source: selectedDependency.source, target: selectedDependency.target } : null}
        availability={availability}
        busy={mutation.isPending}
        error={mutationError}
        onStatusChange={changeStatus}
        onDisconnect={disconnect}
        onRetry={retryOperation}
      />
    </div>
  );
}
