import React, { useState, useRef, useEffect } from "react";
import { CertificateTemplate, CertificateField } from "../types";
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Move, Type as FontIcon, HelpCircle, Image as ImageIcon, Upload, Sparkles, Loader2, Cloud } from "lucide-react";
import { useGooglePicker } from "../hooks/useGooglePicker";

interface TemplateEditorProps {
  template: CertificateTemplate;
  onUpdateFields: (fields: CertificateField[]) => void;
}

export default function TemplateEditor({ template, onUpdateFields }: TemplateEditorProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartOffset = useRef({ startWidth: 0, startHeight: 0, startX: 0, startY: 0, aspect: 1 });
  
  const [isGeneratingBadge, setIsGeneratingBadge] = useState(false);
  const [badgePrompt, setBadgePrompt] = useState("");
  const { openPicker, isReady: gdriveReady } = useGooglePicker();

  const fields = template.fields;
  const fieldsRef = useRef(fields);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Selected field helper
  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const handleGenerateBadge = async () => {
    if (!selectedField) return;
    const promptToUse = badgePrompt.trim() || selectedField.name;
    setIsGeneratingBadge(true);
    try {
      const response = await fetch("/api/generate-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToUse, style: "official minimalist corporate seal" })
      });
      if (!response.ok) throw new Error("Failed to generate");
      const data = await response.json();
      updateField(selectedField.id, { src: data.imageUrl });
    } catch (err) {
      console.error(err);
      alert("Error generating badge. Please try again.");
    } finally {
      setIsGeneratingBadge(false);
    }
  };

  
  const handleDriveBadge = async () => {
    if (!selectedField) return;
    try {
      const base64 = await openPicker();
      if (base64) {
        updateField(selectedField.id, { src: base64 });
      }
    } catch (err) {
      console.error(err);
      alert("Error picking from Google Drive");
    }
  };

  const handleUploadBadge = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedField || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateField(selectedField.id, { src: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  // Update a single field attribute
  const updateField = (fieldId: string, updates: Partial<CertificateField>) => {
    const updated = fieldsRef.current.map((f) => {
      if (f.id === fieldId) {
        return { ...f, ...updates } as CertificateField;
      }
      return f;
    });
    onUpdateFields(updated);
  };

  // Handle click on canvas background to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
      setSelectedFieldId(null);
    }
  };

  // Add a new custom field
  const addCustomField = () => {
    const id = `custom_${Date.now()}`;
    const newField: CertificateField = {
      id,
      name: "Custom Field",
      type: "text",
      text: "Double-click to edit text",
      x: 50,
      y: 50,
      fontSize: 14,
      color: "#1e293b",
      alignment: "center",
      fontFamily: "Inter",
      isDynamic: false,
      placeholderKey: "custom",
    };
    onUpdateFields([...fields, newField]);
    setSelectedFieldId(id);
  };

  const addImageField = () => {
    const id = `image_${Date.now()}`;
    const newField: CertificateField = {
      id,
      name: "Badge / Hologram",
      type: "image",
      text: "Seal", // Not used for drawing image but kept for type compatibility
      src: "https://placehold.co/100x100/emerald/white?text=Badge",
      x: 80,
      y: 80,
      width: 15,
      height: 15,
      blendMode: "multiply",
      opacity: 100, // 0-100
      fontSize: 14,
      color: "#000000",
      alignment: "center",
      fontFamily: "Inter",
      isDynamic: false,
      placeholderKey: "custom",
    };
    onUpdateFields([...fields, newField]);
    setSelectedFieldId(id);
  };

  // Delete a field
  const deleteField = (id: string) => {
    onUpdateFields(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  // Pointer/Mouse Drag Event Handlers for high accuracy positioning
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, field: CertificateField) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setIsDragging(true);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Click position relative to the field center (translated to scale percentages)
      const clickXInPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clickYInPercent = ((e.clientY - rect.top) / rect.height) * 100;
      
      dragStartOffset.current = {
        x: clickXInPercent - field.x,
        y: clickYInPercent - field.y,
      };
    }
    // Capture the pointer to continue receiving events even if dragged outside container boundaries
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, field: CertificateField) => {
    if (!isDragging || selectedFieldId !== field.id || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate current mouse coordinates in percentage of container width/height
    const mouseXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // Apply offset of initial click to prevent "jumping"
    let targetX = mouseXPercent - dragStartOffset.current.x;
    let targetY = mouseYPercent - dragStartOffset.current.y;

    // Clamp values between 2% and 98% to keep text elements on screen
    targetX = Math.max(2, Math.min(98, parseFloat(targetX.toFixed(1))));
    targetY = Math.max(2, Math.min(98, parseFloat(targetY.toFixed(1))));

    updateField(field.id, { x: targetX, y: targetY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, field: CertificateField) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setIsResizing(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickXInPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clickYInPercent = ((e.clientY - rect.top) / rect.height) * 100;
      
      const isImage = field.type === "image";
      const startW = isImage ? (field.width || 15) : (field.fontSize || 14);
      const startH = isImage ? (field.height || 15) : (field.fontSize || 14);
      
      resizeStartOffset.current = {
        startX: clickXInPercent,
        startY: clickYInPercent,
        startWidth: startW,
        startHeight: startH,
        aspect: startH ? startW / startH : 1
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>, field: CertificateField) => {
    if (!isResizing || selectedFieldId !== field.id || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    
    const deltaX = mouseXPercent - resizeStartOffset.current.startX;
    
    if (field.type === "image") {
      let targetWidth = Math.max(5, resizeStartOffset.current.startWidth + deltaX);
      let targetHeight = targetWidth / resizeStartOffset.current.aspect;
      updateField(field.id, { width: targetWidth, height: targetHeight });
    } else {
      let newFontSize = Math.max(8, Math.round(resizeStartOffset.current.startWidth + deltaX * 2));
      updateField(field.id, { fontSize: newFontSize });
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizing) {
      setIsResizing(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div id="template-editor-section" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* 1. Visual Drag and Drop Canvas Area */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Move className="w-4 h-4 text-slate-500" />
            <span>Drag text fields anywhere on the certificate. Click to select and style.</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              id="clear-all-fields-btn"
              onClick={() => onUpdateFields([])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-400 rounded-lg transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button type="button"
              id="add-custom-field-btn"
              onClick={addCustomField}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Text Box</span>
            </button>
            <button type="button"
              id="add-image-field-btn"
              onClick={addImageField}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-blue-950/20 rounded-lg transition-all cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Add Badge/Seal</span>
            </button>
          </div>
        </div>

        {/* Outer frame matching real landscape aspect ratio */}
        <div 
          ref={containerRef}
          onClick={handleCanvasClick}
          className="relative aspect-[4/3] w-full max-w-4xl mx-auto rounded-xl shadow-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-default select-none @container"
        >
          {/* Real Background Image */}
          <img
            src={template.backgroundUrl}
            alt={template.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            referrerPolicy="no-referrer"
          />

          {/* Draggable Layers */}
          {fields.map((field) => {
            const isSelected = field.id === selectedFieldId;
            const isImage = field.type === "image";
            
            let alignmentClass = "transform -translate-x-1/2 -translate-y-1/2";
            if (!isImage) {
              alignmentClass = 
                field.alignment === "left" ? "text-left transform -translate-y-1/2" :
                field.alignment === "right" ? "text-right transform -translate-x-full -translate-y-1/2" :
                "text-center transform -translate-x-1/2 -translate-y-1/2";
            }

            const fontStyle: React.CSSProperties = {
              fontSize: `calc(${field.fontSize} * 0.125cqi)`, // Responsive scaling relative to 800px base width
              fontFamily: field.fontFamily === "Cinzel" ? "'Cinzel', serif" :
                          field.fontFamily === "Playfair Display" ? "'Playfair Display', serif" :
                          field.fontFamily === "Space Grotesk" ? "'Space Grotesk', sans-serif" :
                          field.fontFamily === "JetBrains Mono" ? "'JetBrains Mono', monospace" :
                          field.fontFamily === "Montserrat" ? "'Montserrat', sans-serif" :
                          "'Inter', sans-serif",
              color: field.color,
              backgroundColor: field.backgroundColor || 'transparent',
              width: field.width ? '100%' : 'auto',
              height: (field.type === 'image' || !field.height) ? 'auto' : '100%',
              display: (field.width || field.height) ? 'flex' : 'block',
              alignItems: 'center',
              justifyContent: field.alignment === 'center' ? 'center' : field.alignment === 'right' ? 'flex-end' : 'flex-start',
              opacity: field.opacity !== undefined ? field.opacity / 100 : 1,
            };

            return (
              <div
                id={`field-container-${field.id}`}
                key={field.id}
                onPointerDown={(e) => handlePointerDown(e, field)}
                onPointerMove={(e) => handlePointerMove(e, field)}
                onPointerUp={handlePointerUp}
                style={{
                  position: "absolute",
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: field.width ? `${field.width}%` : undefined,
                  height: (field.type === 'image') ? 'auto' : (field.height ? `${field.height}%` : undefined),
                  cursor: isDragging && isSelected ? "grabbing" : "grab",
                  zIndex: isSelected ? 40 : 20,
                }}
                className={`absolute group touch-none select-none max-w-[85%] ${alignmentClass}`}
              >
                {/* Visual outline indicating selected / hover state */}
                <div 
                  className={`transition-all leading-tight font-medium ${
                    isSelected 
                      ? "ring-2 ring-emerald-500 shadow-lg border border-emerald-500/40 " + (isImage ? "bg-emerald-950/10" : "bg-emerald-950/20 backdrop-blur-[1px]")
                      : "border border-transparent hover:border-slate-700 " + (isImage ? "hover:bg-slate-800/5" : "hover:bg-slate-800/10")
                  } ${!isImage ? "px-3 py-1.5 rounded whitespace-pre-wrap" : "rounded-sm w-full h-auto"}`}
                  style={{
                    ...fontStyle,
                    padding: isImage ? 0 : undefined,
                  }}
                >
                  {isImage ? (
                    field.src ? (
                      <img 
                        src={field.src} 
                        alt={field.name || "Image"} 
                        className="w-full h-full pointer-events-none object-contain"
                        style={{ mixBlendMode: field.blendMode === "multiply" ? "multiply" : "normal" }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[40px] flex items-center justify-center border-2 border-dashed border-slate-600 bg-slate-800/50 rounded text-[10px] text-slate-400 font-medium">
                        Empty Image
                      </div>
                    )
                  ) : field.isDynamic ? (
                    <span className="opacity-90 underline decoration-dotted decoration-emerald-400 decoration-2">
                      {field.placeholderKey === "custom" && field.text ? `{{${field.text}}}` : `{{${field.placeholderKey}}}`}
                    </span>
                  ) : (
                    <span>{field.text || "Empty Field"}</span>
                  )}

                  {/* Tiny label on selected fields */}
                  {field.isDynamic && !isSelected && (
                    <span className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-[9px] text-white font-bold px-1 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Dynamic Placeholder
                    </span>
                  )}

                  {/* Quick delete button */}
                  {isSelected && (
                    <button type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteField(field.id);
                      }}
                      className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md z-50 transition-transform hover:scale-110 pointer-events-auto"
                      title="Delete Element"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* Resize handle */}
                  {isSelected && (
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, field)}
                      onPointerMove={(e) => handleResizePointerMove(e, field)}
                      onPointerUp={handleResizePointerUp}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-md z-50 cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
                      title="Drag to resize"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Side Inspector / Controls Panel */}
      <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm h-fit space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
          <FontIcon className="w-4 h-4 text-emerald-400" />
          <span>Field Inspector</span>
        </h3>

        {selectedField ? (
          <div id="field-inspector-form" className="space-y-4">
            {/* Field Identity */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Field Label
                </label>
                <button type="button"
                  id="delete-field-btn"
                  onClick={() => deleteField(selectedField.id)}
                  className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                  title="Delete field"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                id="inspector-field-name"
                type="text"
                value={selectedField.name}
                onChange={(e) => updateField(selectedField.id, { name: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {selectedField.type !== "image" ? (
              <>
                {/* Field Dynamic/Static Type */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="inspector-dynamic-toggle" className="text-xs font-bold text-slate-300">
                      Dynamic Placeholder
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="inspector-dynamic-toggle"
                        type="checkbox"
                        checked={selectedField.isDynamic}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateField(selectedField.id, { 
                            isDynamic: checked,
                            // Set standard placeholder key if checking, or custom if unchecking
                            placeholderKey: checked && selectedField.placeholderKey === "custom" ? "recipientName" : selectedField.placeholderKey
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-emerald-500/30 peer-checked:after:translate-x-full peer-checked:after:border-slate-950 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                    </label>
                  </div>

                  {selectedField.isDynamic ? (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Map to Excel/CSV Column
                      </label>
                      <select
                        id="inspector-placeholder-key"
                        value={selectedField.placeholderKey}
                        onChange={(e) => updateField(selectedField.id, { placeholderKey: e.target.value as any })}
                        className="w-full text-xs bg-slate-950 px-2.5 py-1.5 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="recipientName">Recipient Full Name</option>
                        <option value="workshopTitle">Workshop/Course Title</option>
                        <option value="date">Date of Award</option>
                        <option value="hours">Hours/Credits</option>
                        <option value="issuerName">Authorized Signatory</option>
                        <option value="custom">Custom mapped column</option>
                      </select>
                      {selectedField.placeholderKey === "custom" && (
                         <input 
                           type="text" 
                           placeholder="Enter custom CSV column header"
                           value={selectedField.text}
                           onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
                           className="w-full text-xs mt-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                         />
                      )}
                      <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                        <HelpCircle className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span>Replaces with your uploaded list values during batch compile.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Static Content text
                      </label>
                      <textarea
                        id="inspector-static-text"
                        value={selectedField.text}
                        onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
                        rows={3}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                      />
                    </div>
                  )}
                </div>

                {/* Typography Controls */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  {/* Font Family */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Font family
                    </label>
                    <select
                      id="inspector-font-family"
                      value={selectedField.fontFamily}
                      onChange={(e) => updateField(selectedField.id, { fontFamily: e.target.value as any })}
                      className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Cinzel">Cinzel (Classic Serif)</option>
                      <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
                      <option value="Space Grotesk">Space Grotesk (Tech Geometric)</option>
                      <option value="Montserrat">Montserrat (Modern Sans)</option>
                      <option value="Inter">Inter (Clean Neutral)</option>
                      <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Font Size
                      </label>
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        {selectedField.fontSize}px
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="inspector-font-size-slider"
                        type="range"
                        min="8"
                        max="72"
                        value={selectedField.fontSize}
                        onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 cursor-ew-resize bg-slate-950 rounded-lg appearance-none h-1.5"
                      />
                    </div>
                  </div>

                  {/* Alignment */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Alignment
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                      <button type="button"
                        id="inspector-align-left-btn"
                        onClick={() => updateField(selectedField.id, { alignment: "left" })}
                        className={`flex justify-center items-center py-1.5 rounded-md transition-colors cursor-pointer ${
                          selectedField.alignment === "left" 
                            ? "bg-slate-900 text-emerald-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button type="button"
                        id="inspector-align-center-btn"
                        onClick={() => updateField(selectedField.id, { alignment: "center" })}
                        className={`flex justify-center items-center py-1.5 rounded-md transition-colors cursor-pointer ${
                          selectedField.alignment === "center" 
                            ? "bg-slate-900 text-emerald-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button type="button"
                        id="inspector-align-right-btn"
                        onClick={() => updateField(selectedField.id, { alignment: "right" })}
                        className={`flex justify-center items-center py-1.5 rounded-md transition-colors cursor-pointer ${
                          selectedField.alignment === "right" 
                            ? "bg-slate-900 text-emerald-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {/* Image Controls */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    AI Generation Prompt
                  </label>
                  <input
                    type="text"
                    value={badgePrompt}
                    onChange={(e) => setBadgePrompt(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
                    placeholder="e.g. Minimalist corporate seal..."
                  />
                  <div className="flex gap-2 mt-2">
                    <label className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-500 hover:bg-slate-800 rounded-lg transition-all cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleUploadBadge} 
                      />
                    </label>
                    <button type="button"
                      disabled={!gdriveReady}
                      onClick={handleDriveBadge}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-300 bg-blue-950/30 border border-blue-900 hover:border-blue-500 hover:bg-blue-900/40 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Drive</span>
                    </button>
                    <button type="button"
                      onClick={handleGenerateBadge}
                      disabled={isGeneratingBadge}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/30 border border-emerald-900 hover:border-emerald-500 hover:bg-emerald-900/40 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingBadge ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{isGeneratingBadge ? "Gen..." : "Generate"}</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1 mt-1">
                    <HelpCircle className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
                    <span>Generate a seal, or upload an existing image.</span>
                  </div>
                </div>

                <div className="space-y-1 pt-3 border-t border-slate-800">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    Image Source (URL or Base64) - Optional
                  </label>
                  <textarea
                    id="inspector-image-src"
                    value={selectedField.src || ""}
                    onChange={(e) => updateField(selectedField.id, { src: e.target.value })}
                    rows={2}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Opacity (Watermark)
                    </label>
                    <span className="text-xs font-mono font-semibold text-emerald-400">
                      {selectedField.opacity ?? 100}%
                    </span>
                  </div>
                  <input
                    id="inspector-opacity-slider"
                    type="range"
                    min="10"
                    max="100"
                    value={selectedField.opacity ?? 100}
                    onChange={(e) => updateField(selectedField.id, { opacity: parseInt(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-ew-resize bg-slate-950 rounded-lg appearance-none h-1.5"
                  />
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="inspector-blend-toggle" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Remove White Background
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="inspector-blend-toggle"
                      type="checkbox"
                      checked={selectedField.blendMode === "multiply"}
                      onChange={(e) => updateField(selectedField.id, { blendMode: e.target.checked ? "multiply" : "normal" })}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>
              </div>
            )}

            {/* Common Color / Mask Section */}
            <div className="pt-2 border-t border-slate-800 space-y-4">
              {selectedField.type !== "image" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Text color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="inspector-color-picker"
                      type="color"
                      value={selectedField.color}
                      onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-800 bg-transparent p-0 cursor-pointer overflow-hidden flex-shrink-0"
                    />
                    <input
                      id="inspector-color-hex"
                      type="text"
                      value={selectedField.color}
                      onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                      placeholder="#000000"
                      className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 uppercase font-mono"
                    />
                  </div>
                  {/* Visual Swatches */}
                  <div className="grid grid-cols-6 gap-1.5 mt-2">
                    {["#000000", "#1e293b", "#718096", "#b39124", "#d4af37", "#064e3b", "#059669", "#1e3a8a", "#ffffff"].map((color) => (
                      <button type="button"
                        key={color}
                        id={`color-swatch-${color.replace("#", "")}`}
                        onClick={() => updateField(selectedField.id, { color })}
                        style={{ backgroundColor: color }}
                        className={`h-5 w-full rounded border transition-transform cursor-pointer ${
                          selectedField.color === color ? "border-emerald-500 scale-110 shadow-sm" : "border-slate-800 hover:scale-105"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Background Mask Color Picker */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1" title="Set a background color to hide existing text on the PDF">
                  Background Color (Mask)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="inspector-bg-color-picker"
                    type="color"
                    value={selectedField.backgroundColor === "transparent" || !selectedField.backgroundColor ? "#ffffff" : selectedField.backgroundColor}
                    onChange={(e) => updateField(selectedField.id, { backgroundColor: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-800 bg-transparent p-0 cursor-pointer overflow-hidden flex-shrink-0"
                  />
                  <button type="button"
                    onClick={() => updateField(selectedField.id, { backgroundColor: "transparent" })}
                    className={`flex-1 text-xs px-3 py-2 border rounded-lg transition-colors ${
                      !selectedField.backgroundColor || selectedField.backgroundColor === "transparent"
                        ? "bg-slate-900 border-emerald-500 text-emerald-400 font-medium"
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900"
                    }`}
                  >
                    Transparent
                  </button>
                  <button type="button"
                    onClick={() => updateField(selectedField.id, { backgroundColor: "#ffffff" })}
                    className={`flex-1 text-xs px-3 py-2 border rounded-lg transition-colors ${
                      selectedField.backgroundColor === "#ffffff"
                        ? "bg-slate-900 border-emerald-500 text-emerald-400 font-medium"
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900"
                    }`}
                  >
                    White
                  </button>
                </div>

                {/* Size Sliders */}
                {(selectedField.type === "image" || (selectedField.backgroundColor && selectedField.backgroundColor !== "transparent")) && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{selectedField.type === "image" ? "Scale (Size)" : "Mask Width"}</label>
                        <span className="text-xs font-mono font-semibold text-emerald-400">{selectedField.width || 0}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100"
                        value={selectedField.width || 0}
                        onChange={(e) => updateField(selectedField.id, { width: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 cursor-ew-resize bg-slate-950 rounded-lg appearance-none h-1.5"
                      />
                    </div>
                    {selectedField.type !== "image" && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mask Height</label>
                          <span className="text-xs font-mono font-semibold text-emerald-400">{selectedField.height || 0}%</span>
                        </div>
                        <input
                          type="range" min="0" max="100"
                          value={selectedField.height || 0}
                          onChange={(e) => updateField(selectedField.id, { height: parseInt(e.target.value) })}
                          className="w-full accent-emerald-500 cursor-ew-resize bg-slate-950 rounded-lg appearance-none h-1.5"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950">
            <Move className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              No field selected. Click on any text box inside the canvas to edit its layout.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
