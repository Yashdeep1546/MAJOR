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
        <h3>Trace Viewer</h3>
        <button className="trace-close" onClick={onClose}>✕</button>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="loading-dots"><span /><span /><span /></div>
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
                  <span className="trace-step-state">{step.state}</span>
                  <span className="trace-step-latency">{step.latencyMs ?? 0}ms</span>
                </div>
                <div className="trace-step-details">
                  {step.modelUsed && step.modelUsed !== 'none' && (
                    <span className="trace-tag">🧠 {step.modelUsed}</span>
                  )}
                  {(step.tokenCount ?? 0) > 0 && (
                    <span className="trace-tag">🪙 {step.tokenCount} tokens</span>
                  )}
                  {step.toolName && (
                    <span className="trace-tag">🔧 {step.toolName}</span>
                  )}
                </div>
                {expandedStep === step.id && (
                  <div className="trace-step-output">
                    {step.toolInput && (
                      <>Input: {JSON.stringify(step.toolInput, null, 2)}{'\n'}</>
                    )}
                    {step.toolOutput && (
                      <>Output: {JSON.stringify(step.toolOutput, null, 2)}</>
                    )}
                    {!step.toolInput && !step.toolOutput && 'No tool data for this step'}
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
              <span className="trace-stat-value">{totalLatency}ms</span>
              <span className="trace-stat-label">Total Latency</span>
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
