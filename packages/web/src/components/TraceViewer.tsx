import { useState, useEffect } from 'react';

interface TraceStep {
  id: string;
  state: string;
  toolName: string | null;
  toolInput: unknown;
  toolOutput: unknown;
  modelUsed: string | null;
  latencyMs: number | null;
  tokenCount: number | null;
  createdAt: string;
}

interface TraceViewerProps {
  sessionId: string;
  onClose: () => void;
}

const STATE_LABELS: Record<string, string> = {
  UNDERSTAND: 'Understand',
  PLAN: 'Plan',
  EXECUTE: 'Execute',
  CRITIQUE: 'Critique',
};

export default function TraceViewer({ sessionId, onClose }: TraceViewerProps) {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/traces/${sessionId}`)
      .then((r) => r.json())
      .then((data) => { setSteps(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  const totalLatency = steps.reduce((sum, s) => sum + (s.latencyMs ?? 0), 0);
  const totalTokens = steps.reduce((sum, s) => sum + (s.tokenCount ?? 0), 0);

  return (
    <div className="trace-panel">
      <div className="trace-header">
        <div>
          <h3 className="trace-title">Execution trace</h3>
          <span className="trace-session">Session {sessionId.slice(0, 8)}</span>
        </div>
        <button className="trace-close" onClick={onClose} aria-label="Close trace">&times;</button>
      </div>

      {loading ? (
        <div className="trace-steps">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="trace-step skeleton">
              <div className="sk sk-title" />
              <div className="sk sk-tags" />
            </div>
          ))}
        </div>
      ) : steps.length === 0 ? (
        <div className="tasks-empty">
          <h3 className="tasks-empty-title">No trace recorded.</h3>
          <p className="tasks-empty-sub">This exchange predates action logging.</p>
        </div>
      ) : (
        <>
          <div className="trace-steps">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`trace-step state-${step.state}`}
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                <div className="trace-step-header">
                  <span className="trace-step-state">{STATE_LABELS[step.state] ?? step.state}</span>
                  <span className="trace-step-latency">{step.latencyMs ?? 0} ms</span>
                </div>
                <div className="trace-tags">
                  {step.modelUsed && step.modelUsed !== 'none' && (
                    <span className="trace-tag"><b>model</b>{step.modelUsed}</span>
                  )}
                  {(step.tokenCount ?? 0) > 0 && (
                    <span className="trace-tag"><b>tokens</b>{step.tokenCount}</span>
                  )}
                  {step.toolName && (
                    <span className="trace-tag"><b>tool</b>{step.toolName}</span>
                  )}
                </div>
                {expandedStep === step.id && (
                  <div className="trace-step-output">
                    {step.toolInput ? (
                      <>Input: {JSON.stringify(step.toolInput, null, 2)}{'\n'}</>
                    ) : null}
                    {step.toolOutput ? (
                      <>Output: {JSON.stringify(step.toolOutput, null, 2)}</>
                    ) : null}
                    {!step.toolInput && !step.toolOutput && 'No tool data for this step.'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="trace-summary">
            <div className="trace-stat">
              <span className="trace-stat-value">{steps.length}</span>
              <span className="trace-stat-label">Steps</span>
            </div>
            <div className="trace-stat">
              <span className="trace-stat-value">{totalLatency} ms</span>
              <span className="trace-stat-label">Latency</span>
            </div>
            <div className="trace-stat">
              <span className="trace-stat-value">{totalTokens}</span>
              <span className="trace-stat-label">Tokens</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
