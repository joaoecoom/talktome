import { useState, useEffect, useRef, useCallback } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition({ onResult, onEnd }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => !!SpeechRecognition);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const isManuallyStopped = useRef(false);
  const interimRef = useRef('');
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      interimRef.current = '';
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (onResultRef.current) {
        onResultRef.current({ final: finalTranscript, interim: interimTranscript });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      let msg = 'Speech recognition error';
      if (event.error === 'not-allowed') msg = 'Microphone permission denied.';
      else if (event.error === 'network') msg = 'Network error during recognition.';
      setError(msg);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!isManuallyStopped.current) {
        // Auto-restart if wasn't stopped intentionally
      }
      if (onEndRef.current) onEndRef.current();
    };

    recognitionRef.current = recognition;

    return () => {
      isManuallyStopped.current = true;
      recognition.abort();
    };
  }, []);

  const startListening = useCallback((lang = 'en-US') => {
    if (!recognitionRef.current || isListening) return;
    isManuallyStopped.current = false;
    recognitionRef.current.lang = lang;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Speech recognition start error:', e);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    isManuallyStopped.current = true;
    recognitionRef.current.stop();
  }, [isListening]);

  return { isListening, isSupported, error, startListening, stopListening };
}
