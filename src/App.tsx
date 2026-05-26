import { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Download, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Check, 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Building, 
  Calendar, 
  User, 
  MapPin, 
  Phone,
  CheckCircle2,
  Trash2,
  BookOpen,
  Info
} from 'lucide-react';

interface AnalysisResult {
  detected_language: string;
  english_summary: string;
  government_department: string;
  state_or_central: string;
  key_information_to_seek: string[];
  pio_designation: string;
  submission_office: string;
  localized_summary_for_speech: string;
}

interface ApplicantDetails {
  name: string;
  address: string;
  phone: string;
  date: string;
}

export default function App() {
  // Navigation & Step tracking
  const [activeStep, setActiveStep] = useState<number>(0);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Form Inputs
  const [selectedLang, setSelectedLang] = useState<string>('hi-IN'); // Default to Hindi
  const [complaintText, setComplaintText] = useState<string>('');
  
  // Applicant details
  const [applicant, setApplicant] = useState<ApplicantDetails>({
    name: '',
    address: '',
    phone: '',
    date: new Date().toISOString().substring(0, 10), // Default to current date YYYY-MM-DD
  });

  // API State results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rtiDraft, setRtiDraft] = useState<string>('');

  // Voice Speech Recognition State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSimulatingVoice, setIsSimulatingVoice] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const simulationIntervalRef = useRef<any>(null);

  // Text-To-Speech Playback State
  const [isPlayingSpeech, setIsPlayingSpeech] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Loading & Error indicators
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Pre-configured typical quick templates for underserved citizens
  const sampleComplaints = [
    {
      label: "Ration Outage (Hindi)",
      lang: "hi-IN",
      text: "Mera ration card nahi aaya 3 mahine se, aur dukan wala ration nahi de raha hai."
    },
    {
      label: "Broken Rural Road (English)",
      lang: "en-IN",
      text: "Our village road has not been repaired for 2 years despite multiple complaints to the Panchayat."
    },
    {
      label: "Delayed Scholarship (Telugu)",
      lang: "te-IN",
      text: "Maa babu college scholarship dabbulu inka raaledu, okati sanvatsaram nunchi pending undi."
    },
    {
      label: "Water Supply Stop (Tamil)",
      lang: "ta-IN",
      text: "எங்கள் வார்டில் இரண்டு வாரங்களாக குடிநீர் விநியோகம் நிறுத்தப்பட்டுள்ளது."
    }
  ];

  // List of standard languages supported in the UI
  const languagesList = [
    { code: 'hi-IN', name: 'हिन्दी (Hindi)', native: 'हिन्दी' },
    { code: 'te-IN', name: 'తెలుగు (Telugu)', native: 'తెలుగు' },
    { code: 'ta-IN', name: 'தமிழ் (Tamil)', native: 'தமிழ்' },
    { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)', native: 'ಕನ್ನಡ' },
    { code: 'en-IN', name: 'English (Indian)', native: 'English' }
  ];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsRecording(true);
        setSpeechError(null);
      };

      rec.onresult = (event: any) => {
        let finalTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTrans) {
          setComplaintText(prev => (prev + ' ' + finalTrans).trim());
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow microphone permissions in your browser or iframe settings.');
        } else if (event.error === 'network') {
          setSpeechError('Speech recognition network error. The browser\'s voice service cannot reach the cloud server. Please verify your internet connection, try again, or type your complaint directly in the textbox below.');
        } else {
          setSpeechError(`Speech recognition failed (${event.error}). Please speak clearly into your microphone or type manually.`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      stopVoiceRecording();
      stopVoicePlayback();
    };
  }, []);

  // Update voice language when selection changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLang;
    }
  }, [selectedLang]);

  // Simulated speech generator for network limits / testing fallback
  const simulateSpeechInput = () => {
    stopVoicePlayback();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    setSpeechError(null);
    setIsSimulatingVoice(true);
    setIsRecording(true);
    setComplaintText('');

    const library: Record<string, string> = {
      'hi-IN': "Mera ration card nahi aaya 3 mahine se, aur dukan wala ration nahi de raha hai. Kripya iski jankari pradan karein.",
      'te-IN': "Maa babu college scholarship dabbulu inka raaledu, okati sanvatsaram nunchi pending undi. Sanchalana adhikaari details kavali.",
      'ta-IN': "எங்கள் வார்டில் இரண்டு வாரங்களாக குடிநீர் விநியோகம் நிறுத்தப்பட்டுள்ளது. இதனால் மக்கள் மிகவும் கஷ்டப்படுகிறார்கள்.",
      'kn-IN': "ನಮ್ಮ ಗ್ರಾಮೀಣ ರಸ್ತೆ ಇನ್ನೂ ದುರಸ್ತಿಯಾಗಿಲ್ಲ, ಪಂಚಾಯತ್ ಸಿಬ್ಬಂದಿ ಗಮನ ಹರಿಸುತ್ತಿಲ್ಲ ಮತ್ತು ಕೆಲಸದ ವಿವರ ಬೇಕಾಗಿದೆ.",
      'en-IN': "Our village road has not been repaired for 2 years despite multiple complaints to the Panchayat, requesting official contract maps."
    };

    const targetText = library[selectedLang] || library['hi-IN'];
    let currentIdx = 0;

    simulationIntervalRef.current = setInterval(() => {
      if (currentIdx < targetText.length) {
        setComplaintText(targetText.substring(0, currentIdx + 1));
        currentIdx++;
      } else {
        clearInterval(simulationIntervalRef.current);
        setIsSimulatingVoice(false);
        setIsRecording(false);
      }
    }, 45); // elegant typewriter velocity
  };

  // Voice Transcription Toggle
  const startVoiceRecording = () => {
    stopVoicePlayback();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      setIsSimulatingVoice(false);
    }
    setSpeechError(null);
    if (!recognitionRef.current) {
      setSpeechError("Voice input is not supported by your browser. Please type your grievance directly.");
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopVoiceRecording = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      setIsSimulatingVoice(false);
    }
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
      setIsRecording(false);
    }
  };

  // Text to Speech playback (Accessibility helper)
  const speakText = (text: string) => {
    if (!synthRef.current) return;
    
    stopVoicePlayback();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const cleanCode = selectedLang.split('-')[0];
    const matchVoice = voices.find(v => v.lang.startsWith(cleanCode));
    if (matchVoice) {
      utterance.voice = matchVoice;
    }
    
    utterance.onend = () => {
      setIsPlayingSpeech(false);
    };
    utterance.onerror = () => {
      setIsPlayingSpeech(false);
    };

    setIsPlayingSpeech(true);
    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopVoicePlayback = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlayingSpeech(false);
  };

  // Step 1: Submit complaint text to Analyze API
  const handleAnalyzeComplaint = async () => {
    if (!complaintText.trim()) {
      setApiError("Please state your problem first using Voice or Typing.");
      return;
    }

    setIsLoading(true);
    setApiError(null);
    stopVoiceRecording();
    stopVoicePlayback();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint: complaintText,
          language: languagesList.find(l => l.code === selectedLang)?.name || 'Auto-detect'
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server failed to analyze the public grievance.');
      }

      const data: AnalysisResult = await response.json();
      setAnalysis(data);
      setActiveStep(1); // Proceed to confirmation/details step
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Custom details update by user
  const handleEditInformationPoint = (index: number, newValue: string) => {
    if (!analysis) return;
    const updatedPoints = [...analysis.key_information_to_seek];
    updatedPoints[index] = newValue;
    setAnalysis({
      ...analysis,
      key_information_to_seek: updatedPoints
    });
  };

  const handleAddFieldDetails = () => {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      key_information_to_seek: [...analysis.key_information_to_seek, ""]
    });
  };

  const handleRemoveFieldDetails = (index: number) => {
    if (!analysis) return;
    const updatedPoints = analysis.key_information_to_seek.filter((_, i) => i !== index);
    setAnalysis({
      ...analysis,
      key_information_to_seek: updatedPoints
    });
  };

  // Step 3: Trigger legal draft generation API
  const handleGenerateDraft = async () => {
    if (!analysis) return;

    setIsLoading(true);
    setApiError(null);
    stopVoicePlayback();

    try {
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysis,
          applicantDetails: applicant
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate legal RTI draft');
      }

      const data = await response.json();
      setRtiDraft(data.draft);
      setActiveStep(2); // Proceed to legal draft preview step
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || 'Failed to generate application draft.');
    } finally {
      setIsLoading(false);
    }
  };

  // Secondary actions
  const handleCopyText = () => {
    navigator.clipboard.writeText(rtiDraft);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadText = () => {
    const element = document.createElement("a");
    const file = new Blob([rtiDraft], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `RTI_Application_${applicant.name.replace(/\s+/g, '_') || 'Draft'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleReset = () => {
    setActiveStep(0);
    setComplaintText('');
    setAnalysis(null);
    setRtiDraft('');
    setApiError(null);
    stopVoicePlayback();
    stopVoiceRecording();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-12">
      
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-base tracking-wider shadow-sm">
              RTI
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5 matches-base-layout">
                RTI Voice Assistant
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Act 2005
                </span>
              </h1>
              <p className="text-xs text-slate-500">Draft your application professionally in seconds</p>
            </div>
          </div>
          <button 
            id="btn_help_info"
            onClick={() => setShowHelpModal(true)} 
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg font-medium hover:bg-slate-100 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-slate-600" />
            <span>RTI Guide</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 mt-8">
        
        {/* Step Indicators */}
        <div className="mb-8 flex items-center justify-between px-2 text-xs text-slate-500 font-medium">
          <button 
            onClick={() => { if(activeStep > 0) setActiveStep(0); }}
            className={`flex items-center gap-1.5 pb-2 border-b-2 transition-all ${activeStep === 0 ? 'text-indigo-600 border-indigo-600 font-bold' : 'border-transparent hover:text-slate-800'}`}
          >
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>1</span>
            Describe Dilemma
          </button>
          
          <div className="h-px bg-slate-200 flex-1 mx-4 mb-2"></div>
          
          <button 
            disabled={!analysis}
            onClick={() => { if(analysis) setActiveStep(1); }}
            className={`flex items-center gap-1.5 pb-2 border-b-2 transition-all ${activeStep === 1 ? 'text-indigo-600 border-indigo-600 font-bold' : 'border-transparent hover:text-slate-800 disabled:opacity-50'}`}
          >
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>2</span>
            Verify Facts
          </button>
          
          <div className="h-px bg-slate-200 flex-1 mx-4 mb-2"></div>
          
          <button 
            disabled={!rtiDraft}
            onClick={() => { if(rtiDraft) setActiveStep(2); }}
            className={`flex items-center gap-1.5 pb-2 border-b-2 transition-all ${activeStep === 2 ? 'text-indigo-600 border-indigo-600 font-bold' : 'border-transparent hover:text-slate-800 disabled:opacity-50'}`}
          >
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>3</span>
            RTI Draft
          </button>
        </div>

        {/* Informational Alerts */}
        {apiError && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-start gap-3 text-xs">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-red-700 mt-0.5">{apiError}</p>
            </div>
          </div>
        )}

        {/* Global Loading Spinner */}
        {isLoading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-center items-center z-50">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex flex-col items-center max-w-xs mx-auto text-center">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-800">Processing with Gemini AI...</p>
              <p className="text-xs text-slate-500 mt-1.5">Generating formal legal structures and identifying active state departments.</p>
            </div>
          </div>
        )}

        {/* STEP 1: GRIEVANCE ENTRY */}
        {activeStep === 0 && (
          <div className="space-y-6">
            
            {/* Introductory Help banner */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-xl">
              <h2 className="text-xs font-bold text-indigo-900 tracking-wider uppercase mb-1 flex items-center gap-1">
                <Info className="w-4 h-4 text-indigo-700" />
                Empowering Underrepresented Citizens
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                State your village, town, or welfare service problem in your local voice or native typing. Our AI reads the issue, isolates the proper Indian Government Office to target, and drafts a pristine <strong className="text-indigo-900">Section 6(1) RTI Application</strong> automatically.
              </p>
            </div>

            {/* Language Selector + Quick Sample Selector */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Your Language
                </label>
                <div className="relative">
                  <select 
                    id="sel_language"
                    value={selectedLang}
                    onChange={(e) => {
                      setSelectedLang(e.target.value);
                      stopVoiceRecording();
                    }}
                    className="w-full h-11 bg-white border border-slate-300 text-slate-800 text-sm rounded-lg px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                  >
                    {languagesList.map(item => (
                      <option key={item.code} value={item.code}>
                        {item.name} ({item.native})
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-3.5 pointer-events-none text-slate-400 text-xs">▼</span>
                </div>
              </div>

              {/* Quick Template Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Or use a standard mock complaint to try:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sampleComplaints.map((item, idx) => (
                    <button
                      key={idx}
                      id={`btn_sample_${idx}`}
                      onClick={() => {
                        setSelectedLang(item.lang);
                        setComplaintText(item.text);
                        stopVoiceRecording();
                      }}
                      className="text-xs text-left bg-slate-50 hover:bg-slate-100 text-slate-800 px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 active:scale-98 transition-all font-medium"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Complaint Text & Voice Area */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Describe the Complaint / Public Problem:
              </label>

              {/* Big Clean Voice Micro-Button container */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-250/60">
                <button
                  id="btn_microphone"
                  type="button"
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                  className={`w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-md transition-all cursor-pointer ${
                    isRecording 
                      ? 'bg-red-600 border-red-300 text-white animate-pulse' 
                      : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-200 text-white hover:scale-105'
                  }`}
                  aria-label="Microphone Button"
                >
                  {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                
                <p className="text-xs font-bold mt-4 text-slate-800">
                  {isSimulatingVoice ? (
                    <span className="flex items-center gap-2 text-indigo-600">
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
                      Simulating voice input...
                    </span>
                  ) : isRecording ? (
                    "Recording your voice... Click to pause"
                  ) : (
                    "Record with Microphone"
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs text-center">
                  {isSimulatingVoice ? "Simulating regional speech translation typing..." : isRecording ? "Speak clearly." : "Speaks local Indian languages perfectly. Press to begin."}
                </p>

                {speechError && (
                  <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl space-y-3 max-w-sm text-left">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-950">Microphone Socket Warning</p>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          Your browser's speech recognition network returned: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px] text-red-700">{speechError}</code>. 
                          This occurs because modern browsers restrict cloud voice sockets in secure sandbox preview frames.
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white/60 p-2.5 rounded-lg border border-amber-250 flex flex-col items-center gap-1 text-center">
                      <span className="text-[10px] text-slate-500 font-semibold mb-1">Preview without microphone:</span>
                      <button
                        id="btn_run_simulator"
                        type="button"
                        onClick={simulateSpeechInput}
                        className="w-full h-8 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-98 cursor-pointer shadow-xs"
                      >
                        ⚡ Run Offline Voice Simulator
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Typing manual fallback area */}
              <div className="space-y-1">
                <textarea
                  id="txt_complaint"
                  rows={4}
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder="Type or speak the details about roads, water supply, ration cards, school absenteeism or scholarship delays..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-850 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs text-slate-450 pt-1 px-1">
                  <span>Both regional script and transliteration work cleanly.</span>
                  {complaintText && (
                    <button
                      id="btn_clear_text"
                      onClick={() => setComplaintText('')}
                      className="text-red-600 hover:underline font-medium"
                    >
                      Clear text
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn_submit_grievance"
                disabled={!complaintText.trim()}
                onClick={handleAnalyzeComplaint}
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs tracking-wider rounded-lg uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Understand and Structure Grievance</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 2: CONFIRM FACTS / EDIT POINTS */}
        {activeStep === 1 && analysis && (
          <div className="space-y-6">
            
            <button
              id="btn_back_to_0"
              onClick={() => setActiveStep(0)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-all font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Go back & record problem again
            </button>

            {/* Analysis card details */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-5">
              
              <div className="flex justify-between items-start border-b border-indigo-50 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Intelligent Analysis Extracted</h3>
                  <p className="text-xs text-slate-500">Verify department and details before structuring legal document</p>
                </div>
                
                {/* Speech synthesizer read aloud feedback */}
                <button
                  id="btn_tts_read_aloud"
                  onClick={() => speakText(analysis.localized_summary_for_speech || `The identified department is ${analysis.government_department}. English translation states: ${analysis.english_summary}`)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-all cursor-pointer ${
                    isPlayingSpeech 
                      ? 'bg-amber-50 text-amber-800 border-amber-300' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                  }`}
                  title="Read Aloud Analysis"
                >
                  {isPlayingSpeech ? <VolumeX className="w-4 h-4 text-amber-700" /> : <Volume2 className="w-4 h-4 text-slate-700" />}
                  <span>{isPlayingSpeech ? "Stop" : "Listen Summary"}</span>
                </button>
              </div>

              {/* Identified Details Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Input Language</span>
                  <span className="font-bold text-slate-800">{analysis.detected_language}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Category Jurisdiction</span>
                  <span className="font-bold text-slate-800">{analysis.state_or_central}</span>
                </div>
                <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    Target Public Department Authority
                  </span>
                  <span className="font-bold text-indigo-700 text-sm">{analysis.government_department}</span>
                </div>
                <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">English summary of the issue</span>
                  <p className="text-slate-700 leading-relaxed text-xs italic">"{analysis.english_summary}"</p>
                </div>
              </div>

              {/* Editable Information sought section */}
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Information Points Asked to Government:
                  </span>
                  <button
                    id="btn_add_info_query"
                    onClick={handleAddFieldDetails}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    + Add New Question
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  These points will generate as official numbered requests under Section 6(1) of the RTI Act. You can refine or edit them directly inside the textareas.
                </p>

                <div className="space-y-3">
                  {analysis.key_information_to_seek.map((point, index) => (
                    <div key={index} className="flex items-start gap-2.5">
                      <span className="text-xs bg-slate-150 text-slate-600 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-1 font-mono">{index + 1}</span>
                      <div className="flex-1">
                        <textarea
                          rows={2}
                          value={point}
                          onChange={(e) => handleEditInformationPoint(index, e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-lg p-2.5 text-xs text-slate-850 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed transition-all resize-none"
                        />
                      </div>
                      <button
                        id={`btn_remove_query_${index}`}
                        onClick={() => handleRemoveFieldDetails(index)}
                        className="text-slate-400 hover:text-red-650 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-1 hover:bg-red-50 transition-all cursor-pointer"
                        title="Remove Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Application credentials filling */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Standard Applicant Details</h3>
                <p className="text-xs text-slate-500">Enter your name and address below so they are correctly printed on the final application.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-450" /> Full Name of Applicant
                  </label>
                  <input
                    id="txt_applicant_name"
                    type="text"
                    placeholder="Manoj Kumar Verma"
                    value={applicant.name}
                    onChange={(e) => setApplicant({ ...applicant, name: e.target.value })}
                    className="w-full h-10 bg-white border border-slate-300 text-slate-800 px-3 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-450" /> Postal Address (Where replies should be sent)
                  </label>
                  <textarea
                    id="txt_applicant_address"
                    rows={2}
                    placeholder="Address, Village/Block Name, District, State & Pin Code"
                    value={applicant.address}
                    onChange={(e) => setApplicant({ ...applicant, address: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-450" /> Contact Phone number
                    </label>
                    <input
                      id="txt_applicant_phone"
                      type="tel"
                      placeholder="9876543210"
                      value={applicant.phone}
                      onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
                      className="w-full h-10 bg-white border border-slate-300 text-slate-800 px-3 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-450" /> Document Date
                    </label>
                    <input
                      id="txt_applicant_date"
                      type="date"
                      value={applicant.date}
                      onChange={(e) => setApplicant({ ...applicant, date: e.target.value })}
                      className="w-full h-10 bg-white border border-slate-300 text-slate-800 px-3 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Next Action Trigger */}
            <button
              id="btn_draft_rti_action"
              onClick={handleGenerateDraft}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wider rounded-lg uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span>Build Legal RTI Document</span>
              <FileText className="w-4 h-4" />
            </button>

          </div>
        )}

        {/* STEP 3: RTI DRAFT PREVIEW & GUIDE */}
        {activeStep === 2 && rtiDraft && (
          <div className="space-y-6">
            
            <button
              id="btn_back_to_1"
              onClick={() => setActiveStep(1)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-all font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Modify details or questions
            </button>

            {/* Completed Draft Container */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
              
              <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Formal RTI Draft (Section 6)
                  </h3>
                  <p className="text-xs text-slate-500">Copy or Download this compliant template</p>
                </div>
                
                {/* Text To Speech on Draft */}
                <button
                  id="btn_tts_read_draft"
                  onClick={() => speakText(rtiDraft)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-all cursor-pointer ${
                    isPlayingSpeech 
                      ? 'bg-amber-50 text-amber-800 border-amber-300' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                  }`}
                  title="Speak Legal Document Out Loud"
                >
                  {isPlayingSpeech ? <VolumeX className="w-4 h-4 text-amber-500 animate-pulse" /> : <Volume2 className="w-4 h-4 text-slate-600" />}
                  <span>{isPlayingSpeech ? "Stop voice" : "Listen Draft"}</span>
                </button>
              </div>

              {/* The copyable legal draft form rendered in clean monospace textbox */}
              <div className="relative">
                <textarea
                  id="txt_rti_draft"
                  rows={15}
                  value={rtiDraft}
                  onChange={(e) => setRtiDraft(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg p-4 text-xs font-mono text-slate-800 leading-relaxed outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all select-all resize-none"
                />
                
                {/* Floating quick actions */}
                <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
                  <button
                    id="btn_copy_shortcut"
                    onClick={handleCopyText}
                    className="h-8 px-3 bg-white border border-slate-2550 hover:bg-slate-50 rounded-md text-slate-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border-slate-200 shadow-xs"
                    title="Copy to Clipboard"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Operation Export Trigger Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  id="btn_copy_large"
                  onClick={handleCopyText}
                  className="h-11 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copySuccess ? "Copied to Clipboard" : "Copy to Clipboard"}</span>
                </button>

                <button
                  id="btn_download_large"
                  onClick={handleDownloadText}
                  className="h-11 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Download Text Document</span>
                </button>
              </div>

            </div>

            {/* Submission Instructions Card Block */}
            {analysis && (
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3 text-xs text-emerald-990">
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900">Next Steps to Submit your RTI:</h4>
                    <p className="text-slate-600 mt-0.5">Follow this guide to make this application legally active and binding.</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-slate-700">
                  <div className="flex items-start gap-3">
                    <span className="h-5 w-5 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-slate-200">1</span>
                    <div>
                      <strong className="text-slate-900 font-semibold block">Step 1: Sign the document</strong>
                      <p className="text-slate-600">Print out this draft on any standard paper and sign physically in black or blue ink as the applicant.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="h-5 w-5 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-slate-200">2</span>
                    <div>
                      <strong className="text-slate-900 font-semibold block">Step 2: Attach the ₹10 Fee</strong>
                      <p className="text-slate-600">
                        Under Section 6, a standard fee of <strong className="text-slate-900 font-bold">₹10</strong> is needed. Attach an Indian Postal Order (IPO), a Demand Draft, or Court Fee Stamp of ₹10, purchased from your nearest post office.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="h-5 w-5 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-slate-200">3</span>
                    <div>
                      <strong className="text-slate-900 font-semibold block">Step 3: Post or Hand-Deliver</strong>
                      <div className="p-3 my-2 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <p className="text-slate-510 uppercase text-[10px] font-bold tracking-wider">Public Officer Recipient Address:</p>
                        <p className="text-slate-900 font-bold">{analysis.pio_designation}</p>
                        <p className="text-indigo-700 font-medium">{analysis.government_department}</p>
                        <p className="text-slate-650 font-medium">Headquarters Office: {analysis.submission_office}</p>
                      </div>
                      <p className="text-slate-600">
                        Deliver it in-person directly to the reception desk, or send it by <strong className="text-slate-900 font-semibold">Speed Post / Registered Post</strong>. Under Section 7(1), the officer must provide written response inside <strong className="text-indigo-900 font-bold">30 Days</strong> or face formal financial penalties.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Restart Operation */}
            <button
              id="btn_restart_lobby"
              onClick={handleReset}
              className="w-full h-11 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs tracking-wider rounded-lg uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Draft another application</span>
            </button>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-14 max-w-2xl mx-auto px-4 text-center space-y-2 border-t border-slate-200 pt-6">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          The Indian Right to Information Act, 2005 permits non-English translations and mandates Public Information Officers to assist citizens. Section 6(1) outlines information requests, and Section 7(1) demands strict 30-day response periods.
        </p>
        <p className="text-[10px] text-slate-400">
          Intelligent parsing, translation, and structured draft powered by Gemini on server. 
        </p>
      </footer>

      {/* HELP INSTRUCTIONS MODAL/DIALOG */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                RTI Guide & Legal Information
              </span>
              <button 
                id="btn_close_help"
                onClick={() => setShowHelpModal(false)} 
                className="text-slate-400 hover:text-slate-705 text-sm font-bold font-mono py-1 px-2.5 rounded hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed max-h-96 overflow-y-auto pr-1">
              <div>
                <strong className="text-slate-900 font-semibold block">What is the RTI Act 2005?</strong>
                <p className="text-slate-600 mt-0.5">
                  It is a revolutionary Indian law allowing every common citizen to source transparency records directly from government personnel. You can seek records related to state expenditures, list of welfare beneficiaries, delays, or physical maps.
                </p>
              </div>

              <div>
                <strong className="text-slate-900 font-semibold block">Do I need to speak or write in English?</strong>
                <p className="text-slate-600 mt-0.5">
                  No. Speak or write in your regional tongue (Hindi, Telugu, Tamil, Kannada, or English). Our application parses regional inputs and produces the legally validated, highly-precise draft in formal English so public registries cannot reject it.
                </p>
              </div>

              <div>
                <strong className="text-slate-900 font-semibold block">How much are the filing fees?</strong>
                <p className="text-slate-600 mt-0.5">
                  The primary application fee is ₹10. You can easily procure a standard Indian Postal Order (IPO) or court stamp worth Rs 10 from your local Post Office, or pay digitally on corresponding state portals.
                </p>
              </div>

              <div>
                <strong className="text-slate-900 font-semibold block">What if they fail to answer?</strong>
                <p className="text-slate-600 mt-0.5">
                  If the government office fails to yield response inside 30 days, file an appeal to the State or Central Information Commission. The official PIO can be fined up to ₹250 for every day of delay!
                </p>
              </div>
            </div>

            <button
              id="btn_got_it_help"
              onClick={() => setShowHelpModal(false)}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs tracking-wider cursor-pointer transition-all"
            >
              GOT IT
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
