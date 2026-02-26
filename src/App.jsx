import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { WaveVisualizer } from './components/WaveVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { formatText, translateText, formatAndTranslate } from './services/aiService';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'ko', label: 'Korean' },
];

const SPEECH_LANGS = [
  { code: 'en-US', label: '🇺🇸 English (US)' },
  { code: 'en-GB', label: '🇬🇧 English (UK)' },
  { code: 'es-ES', label: '🇪🇸 Spanish' },
  { code: 'pt-BR', label: '🇧🇷 Portuguese (BR)' },
  { code: 'fr-FR', label: '🇫🇷 French' },
  { code: 'de-DE', label: '🇩🇪 German' },
  { code: 'it-IT', label: '🇮🇹 Italian' },
  { code: 'ja-JP', label: '🇯🇵 Japanese' },
  { code: 'zh-CN', label: '🇨🇳 Chinese' },
  { code: 'ar-SA', label: '🇸🇦 Arabic' },
];

const HAS_API_KEY = !!import.meta.env.VITE_OPENROUTER_API_KEY;

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | listening | processing | done | error
  const [autoFormat, setAutoFormat] = useState(true);
  const [translate, setTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState('es');
  const [speechLang, setSpeechLang] = useState('en-US');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inputCopied, setInputCopied] = useState(false);
  const finalTranscriptRef = useRef('');

  const handleSpeechResult = useCallback(({ final, interim }) => {
    if (final) {
      finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + final;
      setInputText(finalTranscriptRef.current);
      setInterimText('');
    } else {
      setInterimText(interim);
    }
  }, []);

  const handleSpeechEnd = useCallback(() => {
    setInterimText('');
    setStatus(prev => prev === 'listening' ? 'idle' : prev);
  }, []);

  const { isListening, isSupported, error: speechError, startListening, stopListening } =
    useSpeechRecognition({ onResult: handleSpeechResult, onEnd: handleSpeechEnd });

  useEffect(() => {
    if (speechError) {
      setError(speechError);
      setStatus('error');
    }
  }, [speechError]);

  const handleToggleRecord = () => {
    if (isListening) {
      stopListening();
      setStatus('idle');
    } else {
      finalTranscriptRef.current = '';
      setInputText('');
      setInterimText('');
      setOutputText('');
      setError(null);
      setStatus('listening');
      startListening(speechLang);
    }
  };

  const handleProcess = async () => {
    const text = inputText.trim();
    if (!text) return;
    if (!HAS_API_KEY) {
      setError('No API key found. Please add your OpenAI key as VITE_OPENAI_API_KEY in the .env file.');
      return;
    }

    setStatus('processing');
    setError(null);
    try {
      let result = '';
      if (autoFormat && translate) {
        result = await formatAndTranslate(text, LANGUAGES.find(l => l.code === targetLang)?.label || targetLang);
      } else if (autoFormat) {
        result = await formatText(text);
      } else if (translate) {
        result = await translateText(text, LANGUAGES.find(l => l.code === targetLang)?.label || targetLang);
      } else {
        result = text;
      }
      setOutputText(result);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'An error occurred during processing.');
      setStatus('error');
    }
  };

  const handleCopy = async (text, setCopiedFn) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleClearInput = () => {
    setInputText('');
    setInterimText('');
    finalTranscriptRef.current = '';
    setOutputText('');
    setStatus('idle');
    setError(null);
  };

  const statusLabel = {
    idle: 'Ready to listen',
    listening: 'Listening…',
    processing: 'Processing with AI…',
    done: 'Done',
    error: 'Error',
  }[status];

  const statusDotClass = {
    idle: '',
    listening: 'listening',
    processing: 'processing',
    done: 'done',
    error: '',
  }[status];

  const displayedInput = inputText + (interimText ? (inputText ? ' ' : '') + interimText : '');

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">🎙️</div>
          <span className="header-logo-text">Talk To Me</span>
        </div>
        <span className="header-badge">AI-Powered</span>
      </header>

      <main className="main">
        {/* Title */}
        <div className="page-title">
          <h1>
            <span className="gradient-text">Speak. </span>
            Format. <span className="gradient-text">Translate.</span>
          </h1>
          <p>Dictate text naturally, and let AI clean it up and translate it instantly.</p>
        </div>

        {/* Speech lang + Record Button */}
        <div className="recording-zone">
          {isSupported && (
            <select
              className="lang-select"
              value={speechLang}
              onChange={e => setSpeechLang(e.target.value)}
              disabled={isListening}
              aria-label="Speech recognition language"
            >
              {SPEECH_LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          )}

          <div className="record-btn-wrapper">
            {isListening && (
              <>
                <div className="pulse-ring" />
                <div className="pulse-ring" />
                <div className="pulse-ring" />
              </>
            )}
            <button
              id="record-btn"
              className={`record-btn ${isListening ? 'recording' : 'idle'}`}
              onClick={handleToggleRecord}
              disabled={!isSupported}
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
              title={!isSupported ? 'Speech recognition not supported in this browser' : ''}
            >
              <span className="record-btn-icon">{isListening ? '⏹' : '🎤'}</span>
              <span>{isListening ? 'Stop' : 'Talk'}</span>
            </button>
          </div>

          {isListening && <WaveVisualizer isActive={true} />}

          <div className="status-bar">
            <div className={`status-dot ${statusDotClass}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* Browser compatibility notice */}
        {!isSupported && (
          <div className="no-support-notice">
            ⚠️ Your browser doesn't support speech recognition. Please use Chrome or Edge. You can still type in the input below.
          </div>
        )}

        {/* API Key notice */}
        {!HAS_API_KEY && (
          <div className="api-notice">
            <strong>⚡ AI features</strong> require an OpenRouter API key. Create a <code>.env</code> file in the project root and add: <code>VITE_OPENROUTER_API_KEY=sk-or-...your-key...</code>. Get a free key at <strong>openrouter.ai</strong>. Speech recording works without a key.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-toast">
            <span>⚠️</span>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
          </div>
        )}

        {/* Options Bar */}
        <div className="options-bar">
          <div className="option-group">
            <label className="toggle-switch" htmlFor="auto-format-toggle">
              <input
                id="auto-format-toggle"
                type="checkbox"
                checked={autoFormat}
                onChange={e => setAutoFormat(e.target.checked)}
              />
              <div className="toggle-track">
                <div className="toggle-thumb" />
              </div>
            </label>
            <span className="option-label">Auto-Format</span>
          </div>

          <div className="divider" />

          <div className="option-group">
            <label className="toggle-switch" htmlFor="translate-toggle">
              <input
                id="translate-toggle"
                type="checkbox"
                checked={translate}
                onChange={e => setTranslate(e.target.checked)}
              />
              <div className="toggle-track">
                <div className="toggle-thumb" />
              </div>
            </label>
            <span className="option-label">Translate to</span>
            <select
              className="lang-select"
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              disabled={!translate}
              aria-label="Target translation language"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="divider" />

          <button
            id="process-btn"
            className={`process-btn ${status === 'processing' ? 'processing' : ''}`}
            onClick={handleProcess}
            disabled={!inputText.trim() || status === 'processing' || (!autoFormat && !translate)}
          >
            {status === 'processing'
              ? <><span className="spin">⚙</span> Processing…</>
              : <>✨ Process</>
            }
          </button>
        </div>

        {/* Workspace: Input + Output */}
        <div className="workspace">
          {/* Input Panel */}
          <div className="text-panel">
            <div className="panel-header">
              <div className="panel-label">
                <div className="panel-label-dot" />
                <span>Input</span>
              </div>
              <div className="panel-actions">
                <button
                  className={`icon-btn ${inputCopied ? 'success' : ''}`}
                  onClick={() => handleCopy(displayedInput, setInputCopied)}
                  title="Copy input"
                  aria-label="Copy input text"
                >
                  {inputCopied ? '✓' : '⎘'}
                </button>
                <button
                  className="icon-btn"
                  onClick={handleClearInput}
                  title="Clear all"
                  aria-label="Clear input"
                >
                  ✕
                </button>
              </div>
            </div>
            <textarea
              id="input-textarea"
              className={`panel-textarea ${interimText && !inputText ? 'interim' : ''}`}
              value={displayedInput}
              onChange={e => {
                setInputText(e.target.value);
                finalTranscriptRef.current = e.target.value;
                setInterimText('');
              }}
              placeholder="Start talking, or type here…"
              spellCheck={false}
              aria-label="Input text area"
            />
            <div className="char-count">{displayedInput.length} characters</div>
          </div>

          {/* Output Panel */}
          <div className="text-panel output-panel">
            <div className="panel-header">
              <div className="panel-label">
                <div className="panel-label-dot output" />
                <span>Output</span>
              </div>
              <div className="panel-actions">
                <button
                  className={`icon-btn ${copied ? 'success' : ''}`}
                  onClick={() => handleCopy(outputText, setCopied)}
                  title="Copy output"
                  disabled={!outputText}
                  aria-label="Copy output text"
                >
                  {copied ? '✓' : '⎘'}
                </button>
              </div>
            </div>
            <textarea
              id="output-textarea"
              className="panel-textarea"
              value={outputText}
              onChange={e => setOutputText(e.target.value)}
              placeholder={status === 'processing' ? 'AI is thinking…' : 'Processed output will appear here…'}
              readOnly={status === 'processing'}
              aria-label="Output text area"
            />
            <div className="char-count">{outputText.length} characters</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>Made with</span>
        <span className="footer-heart">♥</span>
        <span>by Talk To Me</span>
      </footer>
    </div>
  );
}
