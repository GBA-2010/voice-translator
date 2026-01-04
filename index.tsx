import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// -- Types & Interfaces --
type Language = 'ru-RU' | 'zh-CN';
type AppState = 'idle' | 'listening' | 'translating' | 'speaking';

interface TranslationState {
  originalText: string;
  translatedText: string;
  isError: boolean;
}

// -- Constants --
const API_URL = 'https://api.mymemory.translated.net/get';

// -- Helper: Translation API --
async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  // Extract lang code (e.g., 'ru-RU' -> 'ru')
  const src = sourceLang.split('-')[0];
  const tgt = targetLang.split('-')[0];
  
  try {
    const response = await fetch(`${API_URL}?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`);
    const data = await response.json();
    
    if (data.responseStatus !== 200 && data.responseStatus !== '200') {
      throw new Error(data.responseDetails || 'Translation failed');
    }
    return data.responseData.translatedText;
  } catch (error) {
    console.error("Translation API Error:", error);
    return "Translation Error / Ошибка перевода";
  }
}

// -- Main Component --
const App = () => {
  // State for Top Half (Chinese Speaker)
  const [topContent, setTopContent] = useState<TranslationState>({ originalText: '按住说话', translatedText: 'Нажми чтобы сказать', isError: false });
  const [topStatus, setTopStatus] = useState<AppState>('idle');

  // State for Bottom Half (Russian Speaker)
  const [bottomContent, setBottomContent] = useState<TranslationState>({ originalText: 'Удерживайте кнопку', translatedText: '按住说话', isError: false });
  const [bottomStatus, setBottomStatus] = useState<AppState>('idle');

  const recognitionRef = useRef<any>(null);
  
  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    } else {
      alert("Ваш браузер не поддерживает Web Speech API. Пожалуйста, используйте Chrome или Safari.");
    }
  }, []);

  // -- Actions --

  const startListening = (lang: Language) => {
    if (!recognitionRef.current) return;
    
    // Stop any ongoing speech or recognition
    window.speechSynthesis.cancel();
    try { recognitionRef.current.stop(); } catch(e) {}

    recognitionRef.current.lang = lang;
    
    if (lang === 'zh-CN') {
      setTopStatus('listening');
      setBottomStatus('idle'); // Other side idle
    } else {
      setBottomStatus('listening');
      setTopStatus('idle');
    }

    recognitionRef.current.onstart = () => {
      console.log(`Started listening: ${lang}`);
    };

    recognitionRef.current.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log(`Result (${lang}):`, transcript);
      
      handleTranslationProcess(transcript, lang);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Recognition Error:", event.error);
      if (lang === 'zh-CN') setTopStatus('idle');
      else setBottomStatus('idle');
    };
    
    recognitionRef.current.onend = () => {
       // Reset visual listening state if it didn't transition to translating
       // (This is tricky because onresult fires before onend usually, but we manage state manually)
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Start failed", e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleTranslationProcess = async (text: string, sourceLang: Language) => {
    const isRussianSource = sourceLang === 'ru-RU';
    const targetLang = isRussianSource ? 'zh-CN' : 'ru-RU';
    
    // Set UI to translating
    if (isRussianSource) {
      setBottomStatus('translating');
      setBottomContent(prev => ({ ...prev, originalText: text }));
    } else {
      setTopStatus('translating');
      setTopContent(prev => ({ ...prev, originalText: text }));
    }

    // Perform Translation
    const translated = await translateText(text, sourceLang, targetLang);

    // Update UI with result
    if (isRussianSource) {
      setBottomStatus('idle');
      setTopContent({ originalText: text, translatedText: translated, isError: false });
      // Speak the result in the Target Language (Chinese)
      speak(translated, targetLang);
    } else {
      setTopStatus('idle');
      setBottomContent({ originalText: text, translatedText: translated, isError: false });
      // Speak the result in the Target Language (Russian)
      speak(translated, targetLang);
    }
  };

  const speak = (text: string, lang: string) => {
    if (!window.speechSynthesis) return;
    
    // Cancel previous
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;

    // Visual feedback for speaking
    if (lang === 'zh-CN') {
      // Top half is Chinese speaker/listener
      setTopStatus('speaking');
      utterance.onend = () => setTopStatus('idle');
    } else {
      setBottomStatus('speaking');
      utterance.onend = () => setBottomStatus('idle');
    }

    window.speechSynthesis.speak(utterance);
  };

  const clearHistory = () => {
    setTopContent({ originalText: '按住说话', translatedText: 'Нажми чтобы сказать', isError: false });
    setBottomContent({ originalText: 'Удерживайте кнопку', translatedText: '按住说话', isError: false });
    window.speechSynthesis.cancel();
  };

  // Icons
  const MicIcon = () => (
    <svg className="mic-icon" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  );

  return (
    <>
      {/* TOP HALF: CHINESE (OPPONENT) */}
      <div className="split-half top-half">
        <button className="clear-btn" onClick={clearHistory}>清除 (Очистить)</button>
        
        <div className="content-area">
          <div className="translation-text">
            {topContent.translatedText}
          </div>
          {topStatus === 'translating' && <div className="loading-spinner"></div>}
          <div className="original-text">
            {topContent.originalText !== topContent.translatedText ? topContent.originalText : ''}
          </div>
        </div>

        <div 
          className={`mic-button ${topStatus === 'listening' ? 'listening' : ''}`}
          onMouseDown={() => startListening('zh-CN')}
          onMouseUp={stopListening}
          onTouchStart={(e) => { e.preventDefault(); startListening('zh-CN'); }}
          onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
        >
          <MicIcon />
        </div>
        <div className="status-label">
           {topStatus === 'listening' ? '正在听... (Слушаю...)' : 
            topStatus === 'translating' ? '翻译中... (Перевод...)' : 
            topStatus === 'speaking' ? '正在说... (Говорю...)' : '按住说话 (Китайский)'}
        </div>
      </div>

      {/* BOTTOM HALF: RUSSIAN (USER) */}
      <div className="split-half bottom-half">
        <button className="clear-btn" onClick={clearHistory}>Очистить</button>
        
        <div className="content-area">
          <div className="translation-text">
            {bottomContent.translatedText}
          </div>
           {bottomStatus === 'translating' && <div className="loading-spinner"></div>}
          <div className="original-text">
            {bottomContent.originalText !== bottomContent.translatedText ? bottomContent.originalText : ''}
          </div>
        </div>

        <div 
          className={`mic-button ${bottomStatus === 'listening' ? 'listening' : ''}`}
          onMouseDown={() => startListening('ru-RU')}
          onMouseUp={stopListening}
          onTouchStart={(e) => { e.preventDefault(); startListening('ru-RU'); }}
          onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
        >
          <MicIcon />
        </div>
        <div className="status-label">
            {bottomStatus === 'listening' ? 'Слушаю...' : 
             bottomStatus === 'translating' ? 'Перевожу...' : 
             bottomStatus === 'speaking' ? 'Говорю...' : 'Удерживайте (Русский)'}
        </div>
      </div>
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
