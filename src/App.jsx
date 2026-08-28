import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { WaveVisualizer } from './components/WaveVisualizer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { formatText, translateText, formatAndTranslate } from './services/aiService';
import { getCurrentUser, login, logout } from './services/authService';

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

function languageLabel(code) {
  return LANGUAGES.find(l => l.code === code)?.label || code;
}

export default function App() {
  const [authState, setAuthState] = useState('checking');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('geral.joaoecoom@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState('idle');
  const [autoFormat, setAutoFormat] = useState(true);
  const [translate, setTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState('es');
  const [previousTargetLang, setPreviousTargetLang] = useState('en');
  const [speechLang, setSpeechLang] = useState('en-US');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inputCopied, setInputCopied] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const finalTranscriptRef = useRef('');

  const refreshSession = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setCurrentUser(response.user);
      setAuthState('authenticated');
    } catch {
      setCurrentUser(null);
      setAuthState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

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
    setStatus(prev => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const { isListening, isSupported, error: speechError, startListening, stopListening } =
    useSpeechRecognition({ onResult: handleSpeechResult, onEnd: handleSpeechEnd });

  useEffect(() => {
    if (speechError && authState === 'authenticated') {
      setError(speechError);
      setStatus('error');
    }
  }, [speechError, authState]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;

    setNow(Date.now());
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= cooldownUntil) {
        setCooldownUntil(0);
        setError(null);
        setStatus(prev => (prev === 'error' ? 'idle' : prev));
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [cooldownUntil]);

  const resetWorkspace = useCallback(() => {
    setInputText('');
    setInterimText('');
    setOutputText('');
    setStatus('idle');
    setCooldownUntil(0);
    finalTranscriptRef.current = '';
  }, []);

  const handleToggleRecord = () => {
    if (isListening) {
      stopListening();
      setStatus('idle');
      return;
    }

    finalTranscriptRef.current = '';
    setInputText('');
    setInterimText('');
    setOutputText('');
    setError(null);
    setStatus('listening');
    startListening(speechLang);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setError(null);

    try {
      const response = await login(loginEmail, loginPassword);
      setCurrentUser(response.user);
      setAuthState('authenticated');
      setLoginPassword('');
      resetWorkspace();
    } catch (err) {
      setError(err.message || 'Could not log in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setCurrentUser(null);
      setAuthState('unauthenticated');
      setLoginPassword('');
      setError(null);
      resetWorkspace();
    }
  };

  const handleProcess = async () => {
    if (status === 'processing' || authState !== 'authenticated') return;

    const text = inputText.trim();
    if (!text) return;

    setStatus('processing');
    setError(null);

    try {
      let result = '';
      if (autoFormat && translate) {
        result = await formatAndTranslate(text, languageLabel(targetLang));
      } else if (autoFormat) {
        result = await formatText(text);
      } else if (translate) {
        result = await translateText(text, languageLabel(targetLang));
      } else {
        result = text;
      }

      setOutputText(result);
      setStatus('done');
    } catch (err) {
      if (err?.status === 401) {
        setCurrentUser(null);
        setAuthState('unauthenticated');
        setError('Your session expired. Please log in again.');
      } else if (err?.status === 429 || String(err?.message || '').includes('429')) {
        const cooldownMs = err?.retryAfterMs || 12000;
        const retryInSeconds = Math.ceil(cooldownMs / 1000);
        setCooldownUntil(Date.now() + cooldownMs);
        setError(`Rate limit reached. Please wait ${retryInSeconds}s and try again.`);
      } else {
        setError(err.message || 'An error occurred during processing.');
      }

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

  const handleTargetLangChange = (nextLang) => {
    if (nextLang === targetLang) return;
    setPreviousTargetLang(targetLang);
    setTargetLang(nextLang);
  };

  const handleReplaceTargetLang = () => {
    if (!previousTargetLang || previousTargetLang === targetLang) return;
    const currentLang = targetLang;
    setTargetLang(previousTargetLang);
    setPreviousTargetLang(currentLang);
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
  const isCoolingDown = cooldownUntil > now;
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const canProcess =
    authState === 'authenticated' &&
    !!inputText.trim() &&
    status !== 'processing' &&
    (autoFormat || translate) &&
    !isCoolingDown;

  return (
    <div className="app" translate="no">
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">🎙️</div>
          <span className="header-logo-text">Talk To Me</span>
        </div>

        <div className="header-actions">
          {currentUser ? (
            <>
              <span className="header-user">{currentUser.email}</span>
              <button className="header-action-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <span className="header-badge">
              {authState === 'checking' ? 'Checking session' : 'Login required'}
            </span>
          )}
        </div>
      </header>

      <main className="main">
        <div className="page-title">
          <h1>
            <span className="gradient-text">Speak. </span>
            Format. <span className="gradient-text">Translate.</span>
          </h1>
          <p>Dictate text naturally, and let AI clean it up and translate it instantly.</p>
        </div>

        {error && (
          <div className="error-toast">
            <span>⚠️</span>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
          </div>
        )}

        {authState !== 'authenticated' ? (
          <section className="auth-card">
            <div className="auth-card-header">
              <span className="auth-eyebrow">Private Workspace</span>
              <h2>Sign in to use Talk To Me</h2>
              <p>Only authenticated users can access the AI processing API.</p>
            </div>

            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button type="submit" className="auth-submit-btn" disabled={authLoading || authState === 'checking'}>
                {authLoading || authState === 'checking' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </section>
        ) : (
          <>
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

            {!isSupported && (
              <div className="no-support-notice">
                ⚠️ Your browser doesn't support speech recognition. Please use Chrome or Edge. You can still type in the input below.
              </div>
            )}

            <div className="api-notice">
              <strong>🔐 Protected mode</strong> keeps Groq on the server so only logged-in users can trigger AI requests.
            </div>

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
                  onChange={e => handleTargetLangChange(e.target.value)}
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
                type="button"
                className="replace-lang-btn"
                onClick={handleReplaceTargetLang}
                disabled={!translate || !previousTargetLang || previousTargetLang === targetLang}
                title={`Replace with ${languageLabel(previousTargetLang)}`}
                aria-label={`Replace language with ${languageLabel(previousTargetLang)}`}
              >
                <span aria-hidden="true">⇄</span>
                <span>Replace</span>
              </button>

              <button
                id="process-btn"
                className={`process-btn ${status === 'processing' ? 'processing' : ''}`}
                onClick={handleProcess}
                disabled={!canProcess}
              >
                {status === 'processing'
                  ? (
                    <>
                      <span className="spin" aria-hidden="true">⚙</span>
                      <span>Processing…</span>
                    </>
                  )
                  : isCoolingDown
                    ? (
                      <>
                        <span aria-hidden="true">⏳</span>
                        <span>Try again in {cooldownSeconds}s</span>
                      </>
                    )
                    : (
                      <>
                        <span aria-hidden="true">✨</span>
                        <span>Process</span>
                      </>
                    )
                }
              </button>
            </div>

            <div className="workspace">
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
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canProcess) handleProcess();
                    }
                  }}
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
          </>
        )}
      </main>

      <footer className="footer">
        <span>Made with</span>
        <span className="footer-heart">♥</span>
        <span>by Talk To Me</span>
      </footer>
    </div>
  );
}
