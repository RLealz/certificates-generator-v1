import React, { useState } from "react";
import { CertificateTemplate, CertificateField } from "./types";
import { useGooglePicker } from "./hooks/useGooglePicker";
import { PREBUILT_TEMPLATES } from "./components/PrebuiltTemplates";
import TemplateEditor from "./components/TemplateEditor";
import BatchProcessor from "./components/BatchProcessor";
import { 
  Cloud,
  Award, 
  Sparkles, 
  Upload, 
  Layers, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  Image as ImageIcon,
  Check,
  Cpu,
  FileDown,
  Info,
  RefreshCw
} from "lucide-react";

export default function App() {
  const [activeStage, setActiveStage] = useState<"template" | "editor" | "batch">("template");
  
  // App template state (defaults to Classic Ivory)
  const [template, setTemplate] = useState<CertificateTemplate>(PREBUILT_TEMPLATES[0]);
  const { openPicker, isReady: gdriveReady } = useGooglePicker();
  
  // Custom states for Generator tools
  const [bgPrompt, setBgPrompt] = useState("");
  const [bgStyle, setBgStyle] = useState("Corporate Elegant");
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // AI Wording states
  const [topic, setTopic] = useState("");
  const [host, setHost] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState("");
  const [tone, setTone] = useState("Classic Formal");
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  // File Upload states
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  };

  // Convert uploaded background image or PDF to Base64
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      setIsAnalyzing(true);
      showNotification("success", "Rendering PDF page onto canvas. Please wait...");
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          
          // @ts-ignore
          const pdfjsLib = await import("pdfjs-dist");
          // Set worker to the correct unpkg path
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "6.1.200"}/build/pdf.worker.min.mjs`;
          
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          
          // Render at high-resolution (scale 2.0 or 2.5)
          const viewport = page.getViewport({ scale: 2.2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          
          if (!context) {
            throw new Error("Could not create canvas context");
          }
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          } as any).promise;
          
          const base64 = canvas.toDataURL("image/png");
          
          const newTemplate: CertificateTemplate = {
            id: `uploaded_${Date.now()}`,
            name: `Uploaded PDF (${file.name})`,
            backgroundUrl: base64,
            fields: template.fields.length > 0 ? template.fields : [...PREBUILT_TEMPLATES[0].fields]
          };
          
          setTemplate(newTemplate);
          showNotification("success", "✨ PDF template loaded successfully! Use the 'Auto-Replicate Layout' tool to detect text positions.");
        } catch (err: any) {
          console.error("PDF load error:", err);
          showNotification("error", "Failed to render PDF: " + (err.message || err.toString()));
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        
        const newTemplate: CertificateTemplate = {
          id: `uploaded_${Date.now()}`,
          name: `Uploaded Background (${file.name})`,
          backgroundUrl: base64,
          fields: template.fields.length > 0 ? template.fields : [...PREBUILT_TEMPLATES[0].fields]
        };
        setTemplate(newTemplate);
        showNotification("success", "Custom background loaded! Use the 'Auto-Replicate Layout' tool below to detect text positions.");
      };
      reader.readAsDataURL(file);
    }
  };

  // call server API /api/analyze-certificate to auto-detect elements using Gemini Vision
  const runAutoReplication = async () => {
    if (!template.backgroundUrl.startsWith("data:image/")) {
      showNotification("error", "Please upload a custom certificate background first before using layout replication.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: template.backgroundUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze layout.");
      }

      if (data.fields && data.fields.length > 0) {
        // Map detected fields into the layout
        const mappedFields: CertificateField[] = data.fields.map((f: any) => ({
          id: f.id,
          name: f.name || "Custom Field",
          text: f.text || "",
          x: f.x,
          y: f.y,
          fontSize: f.fontSize || 14,
          color: f.color || "#000000",
          alignment: f.alignment || "center",
          fontFamily: f.id === "recipient_name" ? "Playfair Display" : "Inter",
          isDynamic: f.isDynamic ?? false,
          placeholderKey: f.placeholderKey || "custom"
        }));

        setTemplate(prev => ({
          ...prev,
          fields: mappedFields
        }));
        showNotification("success", `✨ Replicated successfully! Detected ${mappedFields.length} text blocks. Feel free to adjust them on Stage 2.`);
      } else {
        showNotification("error", "Could not detect distinct text containers. Loading default layout positioning over background.");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Could not analyze the layout. Ensure you have unlocked your paid models or configured the server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // call server API /api/generate-background (AI Image Gen)
  const handleGenerateBg = async () => {
    if (!bgPrompt) {
      showNotification("error", "Please type a background description style.");
      return;
    }

    setIsGeneratingBg(true);
    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: bgPrompt, style: bgStyle }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image.");
      }

      const generatedTemplate: CertificateTemplate = {
        id: `nano_banana_${Date.now()}`,
        name: `AI Generated: ${bgPrompt.slice(0, 20)}...`,
        backgroundUrl: data.imageUrl,
        fields: template.fields.length > 0 ? template.fields : [...PREBUILT_TEMPLATES[0].fields]
      };

      setTemplate(generatedTemplate);
      showNotification("success", "✨ Bespoke background generated using AI Image Gen!");
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Could not run AI image generation. Ensure your API secrets are configured correctly.");
    } finally {
      setIsGeneratingBg(false);
    }
  };

  // call server API /api/generate-text (Gemini copywriting helper)
  const handleGenerateText = async () => {
    if (!topic || !host) {
      showNotification("error", "Topic and Host of workshop are required.");
      return;
    }

    setIsGeneratingText(true);
    try {
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, host, hours, date, tone }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate copywriting copy.");
      }

      // Update matching fields with AI-generated text copy!
      const updatedFields = template.fields.map((field) => {
        if (field.id === "header") {
          return { ...field, text: data.header };
        } else if (field.id === "subHeader") {
          return { ...field, text: data.subHeader };
        } else if (field.id === "workshop_name") {
          return { ...field, text: data.workshopName };
        } else if (field.id === "achievement_text") {
          return { ...field, text: data.achievementText };
        } else if (field.id === "hours_text" && data.hoursText) {
          return { ...field, text: data.hoursText };
        } else if (field.id === "issuer_name") {
          return { ...field, text: data.issuerName };
        } else if (field.id === "date") {
          return { ...field, text: data.dateText };
        }
        return field;
      });

      setTemplate(prev => ({
        ...prev,
        fields: updatedFields
      }));

      showNotification("success", "✨ Elegant copywriting written by Gemini and loaded into layout!");
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Failed to write copy. Check server endpoints.");
    } finally {
      setIsGeneratingText(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased font-sans">
      {/* Dynamic Notification banner */}
      {notification && (
        <div 
          id="global-notification"
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl shadow-xl z-50 text-xs font-semibold flex items-center gap-2 max-w-lg border transition-all animate-bounce ${
            notification.type === "success" 
              ? "bg-slate-900 border-emerald-500/50 text-emerald-300" 
              : "bg-slate-900 border-red-500/50 text-red-300"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${notification.type === "success" ? "text-emerald-400" : "text-red-400"}`} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-slate-900 border-b border-slate-850 py-3 px-6 sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white font-bold">C</div>
            <div>
              <h1 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-1.5">
                CertifyAI <span className="text-slate-400 font-normal text-xs">v2.4</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">Bespoke design generator backed by Gemini AI</p>
            </div>
          </div>

          {/* Connected state & Nav */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-850 rounded-full border border-slate-800">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-300">AI Image Generator</span>
            </div>

            {/* Wizard Progress Stepper Nav */}
            <nav className="flex items-center gap-1">
              {[
                { id: "template", label: "1. Backdrop & Copy", icon: ImageIcon },
                { id: "editor", label: "2. Layout Editor", icon: Layers },
                { id: "batch", label: "3. Batch Run", icon: Users }
              ].map((stage) => {
                const Icon = stage.icon;
                const isCurrent = activeStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    id={`stage-tab-${stage.id}`}
                    onClick={() => setActiveStage(stage.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isCurrent 
                        ? "bg-emerald-600 text-white shadow shadow-emerald-900/10" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{stage.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* STAGE 1: Backdrop, AI Gen & Auto-Detect Setup */}
        {activeStage === "template" && (
          <div id="stage-1-workspace" className="space-y-6 animate-fade-in">
            {/* Top Info Banner */}
            <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-300 leading-relaxed">
                <strong>How to get started:</strong> Set up your background template using 
                <span className="font-semibold text-slate-200"> Option A: Image Gen AI</span>, 
                <span className="font-semibold text-slate-200"> Option B: Custom File Upload</span>, or 
                <span className="font-semibold text-slate-200"> Option C: Hand-crafted Prebuilts</span>. 
                Then customize the copy with Gemini before proceeding to the drag & drop editor!
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column Controls: Gen and Edit Background */}
              <div className="lg:col-span-4 space-y-5">
                
                {/* 1. AI Background Generator */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Option A: AI Image Gen</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
                        Theme Description
                      </label>
                      <input
                        id="ai-bg-prompt-input"
                        type="text"
                        value={bgPrompt}
                        onChange={(e) => setBgPrompt(e.target.value)}
                        placeholder="e.g. vintage golden ornamental filigree borders"
                        className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
                        Style Preset
                      </label>
                      <select
                        id="ai-bg-style-select"
                        value={bgStyle}
                        onChange={(e) => setBgStyle(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Corporate Modern & Sharp">Corporate Modern & Sharp</option>
                        <option value="Luxury Royal Gold Filigree">Luxury Royal Gold Filigree</option>
                        <option value="Watercolor Floral Artistic">Watercolor Floral Artistic</option>
                        <option value="Minimalist Technical Line Art">Minimalist Technical Line Art</option>
                      </select>
                    </div>
                    <button
                      id="ai-generate-bg-btn"
                      disabled={isGeneratingBg}
                      onClick={handleGenerateBg}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isGeneratingBg ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                          <span>Generating Background...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Generate Background</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. File Upload & Layout Auto-Replication */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Option B: Upload Existing Template</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="relative border border-dashed border-slate-800 hover:border-emerald-500 bg-slate-950/50 hover:bg-emerald-950/10 rounded-xl px-4 py-4 text-center transition-all cursor-pointer group">
                      <input
                        id="certificate-uploader-input"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleUploadImage}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-xs font-medium text-slate-300">
                          {uploadedFileName || "Upload Certificate Image or PDF"}
                        </span>
                        <span className="text-[10px] text-slate-500">PNG, JPG, PDF up to 10MB</span>
                      </div>
                    </div>

                    {/* Auto replication tool */}
                    {template.id.startsWith("uploaded_") && (
                      <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg space-y-2.5">
                        <p className="text-[10px] text-emerald-300 leading-normal">
                          <strong>Certificate Replication:</strong> Let Gemini Vision read your uploaded image to automatically extract and position layout elements!
                        </p>
                        <button
                          id="auto-replicate-layout-btn"
                          disabled={isAnalyzing}
                          onClick={runAutoReplication}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isAnalyzing ? (
                            <>
                              <Cpu className="w-3.5 h-3.5 animate-spin" />
                              <span>Analyzing Vectors...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>✨ Replicate & Map Layout</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Gemini Copywriter generator */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider font-sans">Gemini Copywriting</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
                        Workshop Subject
                      </label>
                      <input
                        id="ai-topic-input"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Modern Fullstack Web Development"
                        className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
                          Issuer/Host
                        </label>
                        <input
                          id="ai-host-input"
                          type="text"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="Google Tech Acad"
                          className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
                          Hours
                        </label>
                        <input
                          id="ai-hours-input"
                          type="text"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          placeholder="12 hours"
                          className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                        />
                      </div>
                    </div>
                    <button
                      id="ai-generate-text-btn"
                      disabled={isGeneratingText}
                      onClick={handleGenerateText}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isGeneratingText ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                          <span>Drafting Copy...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Draft Wording Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Gemini Note Footer (from Design HTML mockup) */}
                <div className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-lg">
                  <p className="text-[10px] text-indigo-300 leading-relaxed">
                    <strong>Gemini Note:</strong> The text has been optimized for clarity and includes placeholders for [Recipient_Name] and [Completion_Date].
                  </p>
                </div>

              </div>

              {/* Right Column Content: Template Selection & Visual Preview */}
              <div className="lg:col-span-8 space-y-5">
                
                {/* Prebuilt cards grid */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                  <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Option C: Select a Fine-Crafted Backdrop</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PREBUILT_TEMPLATES.map((t) => {
                      const isSelected = template.id === t.id;
                      return (
                        <button
                          key={t.id}
                          id={`prebuilt-template-option-${t.id}`}
                          onClick={() => setTemplate(t)}
                          className={`group text-left border rounded-xl p-2.5 bg-slate-950/40 hover:bg-slate-950 transition-all overflow-hidden flex flex-col gap-1.5 cursor-pointer ${
                            isSelected 
                              ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-slate-950" 
                              : "border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div className="relative aspect-[4/3] w-full rounded-lg border border-slate-850 overflow-hidden shadow-sm">
                            <img
                              src={t.backgroundUrl}
                              alt={t.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white p-0.5 rounded-full shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[11px] font-bold text-slate-300 truncate">{t.name}</h4>
                            <span className="text-[9px] text-slate-500">
                              {t.fields.filter(f => f.isDynamic).length} dynamic placeholders
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Preview Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col items-center gap-4">
                  <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Active Backdrop Preview</h3>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-900/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {template.name}
                    </span>
                  </div>

                  {/* Backdrop Visual Aspect Frame */}
                  <div className="relative aspect-[4/3] w-full max-w-2xl rounded-xl border border-slate-800 shadow overflow-hidden bg-slate-950">
                    <img
                      src={template.backgroundUrl}
                      alt="Certificate Backdrop"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Move on triggers */}
                  <button
                    id="goto-editor-stage-btn"
                    onClick={() => setActiveStage("editor")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer self-end"
                  >
                    <span>Design Layouts (Stage 2)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: VISUAL EDITOR (Drag-and-Drop coordinates) */}
        {activeStage === "editor" && (
          <div id="stage-2-workspace" className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <button
                id="back-to-stage-1-btn"
                onClick={() => setActiveStage("template")}
                className="flex items-center gap-1.5 px-3.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold rounded-lg border border-slate-800 bg-slate-950 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Adjust Backdrop</span>
              </button>
              
              <div className="text-center hidden md:block">
                <h2 className="text-xs uppercase font-extrabold text-slate-300 tracking-wider">Certificate Vector Editor</h2>
                <p className="text-[10px] text-slate-500 font-medium">Position your text elements precisely before compiler runs</p>
              </div>

              <button
                id="goto-stage-3-btn"
                onClick={() => setActiveStage("batch")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition-colors cursor-pointer"
              >
                <span>Setup Batch Recipients</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Embed Visual Drag & Drop Canvas */}
            <TemplateEditor
              template={template}
              onUpdateFields={(updatedFields) => setTemplate(prev => ({ ...prev, fields: updatedFields }))}
            />
          </div>
        )}

        {/* STAGE 3: BATCH GENERATOR */}
        {activeStage === "batch" && (
          <div id="stage-3-workspace" className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <button
                id="back-to-editor-stage-btn"
                onClick={() => setActiveStage("editor")}
                className="flex items-center gap-1.5 px-3.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold rounded-lg border border-slate-800 bg-slate-950 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Visual Layout Editor</span>
              </button>

              <div className="text-center hidden md:block">
                <h2 className="text-xs uppercase font-extrabold text-slate-300 tracking-wider">Batch Processing & Zip Exporter</h2>
                <p className="text-[10px] text-slate-500 font-medium">Generate, inspect, and package certificates into high-res ZIPs</p>
              </div>

              <div className="w-[100px] md:block hidden" />
            </div>

            {/* Embed Batch Compile Interface */}
            <BatchProcessor template={template} />
          </div>
        )}

      </main>

      {/* Footer bar */}
      <footer className="bg-slate-900 border-t border-slate-850 py-4 px-6 mt-12 text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p className="font-medium">© 2026 CertifyAI. Crafted beautifully in AI Studio Build.</p>
          <div className="flex gap-4">
            <span>Storage: 4.2GB / 10GB</span>
            <span>Cloud: Secure Storage Connected</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-semibold">
            <span className="text-[9px] bg-slate-950 text-emerald-400 border border-emerald-950 px-2 py-0.5 rounded tracking-wider uppercase font-bold">System Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
