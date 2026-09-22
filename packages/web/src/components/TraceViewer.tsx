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
    <aside className="trace-panel">
      <div className="trace-header">
        <div className="trace-header-title">
          <span className="trace-header-icon">🔬</span>
          <div>
            <h3>Audit Trace</h3>
            <p className="trace-header-sub">6-State Orchestrator Verification</p>
          </div>
        </div>
        <button className="trace-close" onClick={onClose} title="Close trace viewer">✕</button>
      </div>

      {loading ? (
        <div className="trace-steps">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="trace-step" style={{ pointerEvents: 'none', opacity: 0.6 }}>
              <div className="trace-step-header">
                <span style={{ width: '80px', height: '14px', background: 'var(--border-card)', borderRadius: '4px', display: 'inline-block' }}></span>
                <span style={{ width: '40px', height: '12px', background: 'var(--border-card)', borderRadius: '4px', display: 'inline-block' }}></span>
              </div>
              <div className="trace-step-details" style={{ marginTop: '8px' }}>
                <span className="trace-tag" style={{ width: '60px', height: '18px', background: 'var(--border-card)', border: 'none' }}></span>
                <span className="trace-tag" style={{ width: '90px', height: '18px', background: 'var(--border-card)', border: 'none' }}></span>
              </div>
            </div>
          ))}
        </div>
      ) : steps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>No trace data available for this session.</p>
        </div>
      ) : (
        <>
          <div className="trace-steps">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`trace-step state-${step.state}`}
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                <div className="trace-step-header">
                  <div className="trace-step-title-wrap">
                    <span className="trace-step-num">#{idx + 1}</span>
                    <span className="trace-step-state">{step.state}</span>
                  </div>
                  <span className="trace-step-latency">{step.latencyMs ?? 0}ms</span>
                </div>
                
                <div className="trace-step-details">
                  {step.modelUsed && step.modelUsed !== 'none' && (
                    <span className="trace-tag model">🧠 {step.modelUsed}</span>
                  )}
                  {(step.tokenCount ?? 0) > 0 && (
                    <span className="trace-tag tokens">🪙 {step.tokenCount} tokens</span>
                  )}
                  {step.toolName && (
                    <span className="trace-tag tool">🔧 {step.toolName}</span>
                  )}
                </div>

                {expandedStep === step.id && (
                  <div className="trace-step-output">
                    {step.toolInput ? (
                      <div style={{ marginBottom: '8px' }}>
                        <span className="trace-output-label">Tool Input:</span>
                        <pre className="trace-code-box">{JSON.stringify(step.toolInput, null, 2)}</pre>
                      </div>
                    ) : null}
                    {step.toolOutput ? (
                      <div>
                        <span className="trace-output-label">Execution Summary:</span>
                        <pre className="trace-code-box">{JSON.stringify(step.toolOutput, null, 2)}</pre>
                      </div>
                    ) : null}
                    {!step.toolInput && !step.toolOutput && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Internal state transition logged without extra I/O payload.
                      </span>
                    )}
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
              <span className="trace-stat-label">Latency</span>
            </div>
            <div className="trace-stat">
              <span className="trace-stat-value">{totalTokens}</span>
              <span className="trace-stat-label">Tokens</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
