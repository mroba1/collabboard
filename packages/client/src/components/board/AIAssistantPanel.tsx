import { useState } from 'react';
import type { DiagramType } from '@collabboard/shared';
import { aiApi } from '../../lib/api/ai.api';
import { useBoardStore } from '../../stores/boardStore';
import { layoutDiagram } from '../../utils/diagramLayout';
import { Button } from '../common/Button';
import './AIAssistantPanel.css';

interface AIAssistantPanelProps {
  boardId: string;
  onClose: () => void;
}

interface QaEntry {
  question: string;
  answer: string;
}

export function AIAssistantPanel({ boardId, onClose }: AIAssistantPanelProps) {
  const viewport = useBoardStore((s) => s.viewport);
  const createObjectsBatch = useBoardStore((s) => s.createObjectsBatch);

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const [question, setQuestion] = useState('');
  const [qaLog, setQaLog] = useState<QaEntry[]>([]);
  const [asking, setAsking] = useState(false);

  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const [diagramPrompt, setDiagramPrompt] = useState('');
  const [diagramType, setDiagramType] = useState<DiagramType>('flowchart');
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSummarize() {
    setSummarizing(true);
    setError(null);
    try {
      const res = await aiApi.summarize(boardId);
      setSummary(res.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSummarizing(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    const q = question.trim();
    try {
      const res = await aiApi.ask(boardId, { question: q });
      setQaLog((prev) => [...prev, { question: q, answer: res.answer }]);
      setQuestion('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  async function handleSuggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await aiApi.suggest(boardId);
      setSuggestions(res.suggestions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function handleGenerateDiagram() {
    if (!diagramPrompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await aiApi.generateDiagram(boardId, { prompt: diagramPrompt.trim(), diagramType });
      const originX = -viewport.x / viewport.scale + 40;
      const originY = -viewport.y / viewport.scale + 40;
      const objects = layoutDiagram(res.nodes, res.edges, res.diagramType, originX, originY);
      createObjectsBatch(objects);
      setDiagramPrompt('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <aside className="ai-panel">
      <div className="ai-panel-header">
        <h2>AI Assistant</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="ai-panel-body">
        {error && <div className="form-error">{error}</div>}

        <section className="ai-section">
          <h3>Summarize the board</h3>
          <Button size="sm" variant="secondary" onClick={handleSummarize} disabled={summarizing}>
            {summarizing ? 'Summarizing…' : 'Summarize'}
          </Button>
          {summary && <p className="ai-output">{summary}</p>}
        </section>

        <section className="ai-section">
          <h3>Ask about this board</h3>
          <div className="ai-qa-log">
            {qaLog.map((entry, i) => (
              <div key={i} className="ai-qa-entry">
                <p className="ai-qa-question">{entry.question}</p>
                <p className="ai-output">{entry.answer}</p>
              </div>
            ))}
          </div>
          <div className="ai-input-row">
            <input
              placeholder="What's missing from this plan?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <Button size="sm" onClick={handleAsk} disabled={asking || !question.trim()}>
              {asking ? '…' : 'Ask'}
            </Button>
          </div>
        </section>

        <section className="ai-section">
          <h3>Suggest next steps</h3>
          <Button size="sm" variant="secondary" onClick={handleSuggest} disabled={suggesting}>
            {suggesting ? 'Thinking…' : 'Suggest ideas'}
          </Button>
          {suggestions && (
            <ul className="ai-suggestion-list">
              {suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="ai-section">
          <h3>Generate a diagram</h3>
          <textarea
            placeholder="e.g. Flowchart for a customer onboarding process"
            value={diagramPrompt}
            onChange={(e) => setDiagramPrompt(e.target.value)}
            rows={3}
          />
          <div className="ai-input-row">
            <select value={diagramType} onChange={(e) => setDiagramType(e.target.value as DiagramType)}>
              <option value="flowchart">Flowchart</option>
              <option value="mindmap">Mind map</option>
              <option value="process">Process diagram</option>
            </select>
            <Button size="sm" onClick={handleGenerateDiagram} disabled={generating || !diagramPrompt.trim()}>
              {generating ? 'Generating…' : 'Generate on canvas'}
            </Button>
          </div>
        </section>
      </div>
    </aside>
  );
}
