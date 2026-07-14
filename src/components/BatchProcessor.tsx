import React, { useState, useRef, useEffect } from "react";
import { CertificateTemplate, CertificateField, Recipient } from "../types";
import { Upload, Download, Users, FileText, CheckCircle, RefreshCw, Eye, AlertCircle, FileSpreadsheet } from "lucide-react";
import JSZip from "jszip";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { Cloud } from "lucide-react";

interface BatchProcessorProps {
  template: CertificateTemplate;
}

export default function BatchProcessor({ template }: BatchProcessorProps) {
  const [inputText, setInputText] = useState<string>("John Doe\nJane Smith\nAlexander Great\nElizabeth Bennet\nBruce Wayne");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<"png" | "pdf">("pdf");
  const [outputResolution, setOutputResolution] = useState<"standard" | "high" | "low">("standard");
  const [fileNamePrefix, setFileNamePrefix] = useState<string>("certificate");

  const getCanvasDimensions = () => {
    switch (outputResolution) {
      case "low": return { w: 800, h: 600 };
      case "high": return { w: 2400, h: 1800 };
      case "standard": default: return { w: 1600, h: 1200 };
    }
  };
  
  // Progress states
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compilationType, setCompilationType] = useState<"zip" | "combined" | string | null>("zip");
  const { token, login, saveToDrive, isReady: gdriveReady } = useGoogleAuth();
  const [compileProgress, setCompileProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse list of names from copy paste
  useEffect(() => {
    const lines = inputText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: Recipient[] = lines.map((name, index) => ({
      id: `recipient_${index}_${Date.now()}`,
      name,
    }));
    setRecipients(parsed);
    setCurrentIndex(0);
  }, [inputText]);

  // Read CSV / TXT file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract rows (handles commas or linebreaks)
      let parsedNames: string[] = [];
      if (file.name.endsWith(".csv")) {
        const lines = text.split(/\r?\n/);
        // Look for common columns like 'name', 'recipient' or just use first column
        parsedNames = lines
          .map((line) => {
            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // handle CSV with quotes
            if (columns.length > 0) {
              const val = columns[0].replace(/^"|"$/g, "").trim();
              return val;
            }
            return "";
          })
          .filter((name) => name.length > 0 && name.toLowerCase() !== "name" && name.toLowerCase() !== "recipient");
      } else {
        // Plain text file, one per line
        parsedNames = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      }

      if (parsedNames.length > 0) {
        setInputText(parsedNames.join("\n"));
        setErrorMessage(null);
      } else {
        setErrorMessage("Could not parse names from file. Please ensure it has one name per line.");
      }
    };
    reader.readAsText(file);
  };

  // Compile a certificate to Canvas and return either raw base64 or a blob
  const drawCertificateOnCanvas = (
    recipient: Recipient, 
    canvas: HTMLCanvasElement, 
    bgImage: HTMLImageElement
  ): Promise<void> => {
    return new Promise(async (resolve) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }

      // Draw background at full high-resolution (1600x1200)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      const loadImg = (src: string): Promise<HTMLImageElement> => {
        return new Promise((res, rej) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });
      };

      // Loop through and draw each field
      for (const field of template.fields) {
        const canvasX = (field.x / 100) * canvas.width;
        const canvasY = (field.y / 100) * canvas.height;

        ctx.save();
        ctx.globalAlpha = field.opacity !== undefined ? field.opacity / 100 : 1;

        if (field.type === "image" && field.src) {
          try {
            const fieldImg = await loadImg(field.src);
            const boxW = field.width ? (field.width / 100) * canvas.width : fieldImg.width;
            const boxH = field.height ? (field.height / 100) * canvas.height : (field.width ? boxW * (fieldImg.height / fieldImg.width) : fieldImg.height);
            
            const imgRatio = fieldImg.width / fieldImg.height;
            const boxRatio = boxW / boxH;
            
            let finalW = boxW;
            let finalH = boxH;
            
            if (imgRatio > boxRatio) {
              finalH = boxW / imgRatio;
            } else {
              finalW = boxH * imgRatio;
            }
            
            if (field.blendMode === "multiply") {
              ctx.globalCompositeOperation = "multiply";
            }
            
            // Draw centered using object-contain dimensions
            ctx.drawImage(fieldImg, canvasX - finalW / 2, canvasY - finalH / 2, finalW, finalH);
          } catch (err) {
            console.warn("Could not load field image", field.src);
          }
          ctx.restore();
          continue;
        }

        // Compute text to print
        let textToPrint = field.text;
        if (field.isDynamic) {
          if (field.placeholderKey === "recipientName") {
            textToPrint = recipient.name;
          } else if (field.placeholderKey === "custom") {
            textToPrint = recipient.customFields?.[field.text] || `{{${field.text}}}`;
          } else if (recipient.customFields && recipient.customFields[field.placeholderKey]) {
            textToPrint = recipient.customFields[field.placeholderKey];
          }
          // Fallback placeholders
          else if (field.placeholderKey === "workshopTitle") {
            const wtField = template.fields.find(f => f.id === "workshop_name");
            textToPrint = wtField ? wtField.text : "Workshop Event";
          } else if (field.placeholderKey === "date") {
            const dField = template.fields.find(f => f.id === "date");
            textToPrint = dField ? dField.text : "Date";
          } else if (field.placeholderKey === "hours") {
            const hField = template.fields.find(f => f.id === "hours_text");
            textToPrint = hField ? hField.text : "";
          } else if (field.placeholderKey === "issuerName") {
            const iField = template.fields.find(f => f.id === "issuer_name");
            textToPrint = iField ? iField.text : "";
          }
        }

        if (!textToPrint) {
          ctx.restore();
          continue;
        }

        // Settings font styles (Double editor size for high-res output)
        const outputFontSize = field.fontSize * (canvas.width / 800);
        const fontName = 
          field.fontFamily === "Cinzel" ? "'Cinzel', serif" :
          field.fontFamily === "Playfair Display" ? "'Playfair Display', serif" :
          field.fontFamily === "Space Grotesk" ? "'Space Grotesk', sans-serif" :
          field.fontFamily === "JetBrains Mono" ? "'JetBrains Mono', monospace" :
          field.fontFamily === "Montserrat" ? "'Montserrat', sans-serif" :
          "'Inter', sans-serif";

        ctx.font = `${outputFontSize}px ${fontName}`;
        ctx.textAlign = field.alignment;
        ctx.textBaseline = "middle";

        // Handle multiline text
        const lines = textToPrint.split('\n');
        const lineHeight = outputFontSize * 1.2;
        
        // Draw background mask if specified
        if (field.backgroundColor && field.backgroundColor !== "transparent") {
          const paddingX = outputFontSize * 0.5;
          const paddingY = outputFontSize * 0.25;

          // Find the maximum line width if explicit width is missing
          let textMaxWidth = 0;
          lines.forEach(line => {
            const metrics = ctx.measureText(line);
            if (metrics.width > textMaxWidth) textMaxWidth = metrics.width;
          });
          const textTotalHeight = lines.length * lineHeight;

          const maskWidth = field.width ? (field.width / 100) * canvas.width : (textMaxWidth + paddingX * 2);
          const maskHeight = field.height ? (field.height / 100) * canvas.height : (textTotalHeight + paddingY * 2);

          let bgX = canvasX;
          let bgY = canvasY - maskHeight / 2; // default center Y

          if (field.alignment === "center") {
            bgX = canvasX - maskWidth / 2;
          } else if (field.alignment === "right") {
            bgX = canvasX - maskWidth;
          }

          if (!field.width && !field.height) {
            // Apply old padding logic if no explicit width/height
            const startY = canvasY - ((lines.length - 1) * lineHeight) / 2;
            bgY = startY - (lineHeight / 2) - paddingY;
          }

          ctx.fillStyle = field.backgroundColor;
          ctx.fillRect(bgX, bgY, maskWidth, maskHeight);
        }

        // Draw text
        ctx.fillStyle = field.color;
        lines.forEach((line, index) => {
          // Center the text block vertically around canvasY
          const lineY = canvasY - ((lines.length - 1) * lineHeight) / 2 + (index * lineHeight);
          ctx.fillText(line, canvasX, lineY);
        });

        ctx.restore();
      }

      resolve();
    });
  };

  // Re-render preview whenever selected recipient or template layout changes
  useEffect(() => {
    if (recipients.length === 0) {
      setPreviewUrl(null);
      return;
    }

    const currentRecipient = recipients[currentIndex];
    if (!currentRecipient) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = template.backgroundUrl;
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const dims = getCanvasDimensions();
      canvas.width = dims.w;
      canvas.height = dims.h;
      
      await drawCertificateOnCanvas(currentRecipient, canvas, img);
      setPreviewUrl(canvas.toDataURL("image/png"));
    };
  }, [template, recipients, currentIndex]);

  // Download a single certificate (PNG or PDF)
  const downloadSingle = async (recipient: Recipient, format: "png" | "pdf" = outputFormat) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = template.backgroundUrl;
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const dims = getCanvasDimensions();
      canvas.width = dims.w;
      canvas.height = dims.h;
      
      await drawCertificateOnCanvas(recipient, canvas, img);
      
      const sanitizedName = recipient.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      
      if (format === "pdf") {
        // @ts-ignore
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileNamePrefix || "certificate"}_${sanitizedName}.pdf`);
      } else {
        const link = document.createElement("a");
        link.download = `${fileNamePrefix || "certificate"}_${sanitizedName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    };
  };

  // Bulk generate ZIP export
  
  const handleSaveToDrive = async (type) => {
    if (recipients.length === 0) return;
    
    let currentToken = token;
    if (!currentToken) {
      try {
        currentToken = await login();
      } catch (err) {
        setErrorMessage("Failed to login to Google Drive: " + err.message);
        return;
      }
    }
    
    if (!currentToken) return;

    setIsCompiling(true);
    setCompilationType(type);
    setCompileProgress({ current: 0, total: recipients.length });
    
    try {
      const bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = template.backgroundUrl;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });

      const canvas = document.createElement("canvas");
      const dims = getCanvasDimensions();
      canvas.width = dims.w;
      canvas.height = dims.h;
      
      let blob = null;
      let filename = "";
      let mimeType = "";

      if (type === "zip") {
        const zip = new JSZip();
        const { jsPDF } = await import("jspdf");

        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          setCompileProgress({ current: i + 1, total: recipients.length });
          await drawCertificateOnCanvas(recipient, canvas, bgImg);

          const sanitizedName = (recipient.name || "recipient").replace(/[^a-z0-9]/gi, '_').toLowerCase();

          if (outputFormat === "pdf") {
            const pdf = new jsPDF({
              orientation: "landscape",
              unit: "px",
              format: [canvas.width, canvas.height]
            });
            pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
            const pdfBlob = pdf.output("blob");
            zip.file(`${i + 1}_${fileNamePrefix || "certificate"}_${sanitizedName}.pdf`, pdfBlob);
          } else {
            const blobPart = await new Promise<Blob>((res) => {
              canvas.toBlob((b) => res(b), "image/png");
            });
            if (blobPart) zip.file(`${i + 1}_${fileNamePrefix || "certificate"}_${sanitizedName}.png`, blobPart);
          }
          await new Promise((r) => setTimeout(r, 40));
        }
        
        blob = await zip.generateAsync({ type: "blob" });
        filename = `${fileNamePrefix || "certificate"}s_${outputFormat}.zip`;
        mimeType = "application/zip";
      } else if (type === "combined") {
        const { jsPDF } = await import("jspdf");
        let pdf = null;
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          setCompileProgress({ current: i + 1, total: recipients.length });
          await drawCertificateOnCanvas(recipient, canvas, bgImg);
          const imgData = canvas.toDataURL("image/png");

          if (i === 0) {
            pdf = new jsPDF({
              orientation: "landscape",
              unit: "px",
              format: [canvas.width, canvas.height]
            });
          } else {
            pdf.addPage([canvas.width, canvas.height], "landscape");
          }

          pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
          await new Promise((r) => setTimeout(r, 40));
        }
        blob = pdf.output("blob");
        filename = `${fileNamePrefix || "certificate"}s_combined.pdf`;
        mimeType = "application/pdf";
      }
      
      setCompileProgress({ current: recipients.length, total: recipients.length, label: "Uploading to Google Drive..." });
      await saveToDrive(currentToken, blob, filename, mimeType);
      
      alert("Successfully saved to Google Drive!");
    } catch (err) {
      console.error(err);
      setErrorMessage("Error saving to Google Drive: " + err.message);
    } finally {
      setIsCompiling(false);
      setCompilationType(null);
    }
  };

  const downloadAllAsZip = async () => {
    if (recipients.length === 0) return;

    setIsCompiling(true);
    setCompilationType("zip");
    setCompileProgress({ current: 0, total: recipients.length });

    try {
      const zip = new JSZip();
      
      // Load background image once to save performance
      const bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = template.backgroundUrl;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });

      const canvas = document.createElement("canvas");
      const dims = getCanvasDimensions();
      canvas.width = dims.w;
      canvas.height = dims.h;

      // Draw each certificate sequentially to update UI progress and prevent memory spikes
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        setCompileProgress({ current: i + 1, total: recipients.length });

        await drawCertificateOnCanvas(recipient, canvas, bgImg);

        const sanitizedName = recipient.name.replace(/[^a-zA-Z0-9_\s-]/g, "");

        if (outputFormat === "pdf") {
          // @ts-ignore
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: [canvas.width, canvas.height]
          });
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
          const pdfBlob = pdf.output("blob");
          zip.file(`${i + 1}_${fileNamePrefix || "certificate"}_${sanitizedName}.pdf`, pdfBlob);
        } else {
          // Extract blob from canvas
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/png");
          });

          if (blob) {
            zip.file(`${i + 1}_${fileNamePrefix || "certificate"}_${sanitizedName}.png`, blob);
          }
        }

        // Mini timeout to allow DOM to refresh the progress bar
        await new Promise((r) => setTimeout(r, 40));
      }

      // Generate the finished zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `${fileNamePrefix || "certificate"}s_export_${outputFormat}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      link.click();

      setIsCompiling(false);
    } catch (err: any) {
      console.error("ZIP Generation error:", err);
      setErrorMessage("Error generating ZIP download: " + err.message);
      setIsCompiling(false);
    }
  };

  // Bulk generate Combined Multi-Page PDF File
  const downloadCombinedPdf = async () => {
    if (recipients.length === 0) return;

    setIsCompiling(true);
    setCompilationType("combined");
    setCompileProgress({ current: 0, total: recipients.length });

    try {
      // @ts-ignore
      const { jsPDF } = await import("jspdf");

      // Load background image once to save performance
      const bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = template.backgroundUrl;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });

      const canvas = document.createElement("canvas");
      const dims = getCanvasDimensions();
      canvas.width = dims.w;
      canvas.height = dims.h;

      let pdf: any = null;

      // Draw each certificate sequentially
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        setCompileProgress({ current: i + 1, total: recipients.length });

        await drawCertificateOnCanvas(recipient, canvas, bgImg);

        const imgData = canvas.toDataURL("image/png");

        if (i === 0) {
          pdf = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: [canvas.width, canvas.height]
          });
        } else {
          pdf.addPage([canvas.width, canvas.height], "landscape");
        }

        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

        // Mini timeout to allow UI update
        await new Promise((r) => setTimeout(r, 40));
      }

      if (pdf) {
        pdf.save(`${fileNamePrefix || "certificate"}s_batch_combined.pdf`);
      }

      setIsCompiling(false);
    } catch (err: any) {
      console.error("Combined PDF Generation error:", err);
      setErrorMessage("Error generating combined PDF: " + err.message);
      setIsCompiling(false);
    }
  };

  return (
    <div id="batch-processor-section" className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Input: List of Names and CSV Upload */}
      <div className="xl:col-span-4 space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Recipients List</h3>
              <p className="text-[10px] text-slate-500">Provide names to batch render certificates.</p>
            </div>
          </div>

          {/* Copy-Paste Text Area */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
              Enter Names (One per line)
            </label>
            <textarea
              id="recipient-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed placeholder-slate-600"
              placeholder="Alice Johnson&#10;Bob Carter&#10;Charlie Smith"
            />
          </div>

          {/* CSV File Upload Section */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider block">
              Or Upload CSV / TXT List
            </label>
            <div className="relative border border-dashed border-slate-800 hover:border-emerald-500 bg-slate-950/50 hover:bg-emerald-950/10 rounded-xl px-4 py-3.5 transition-colors text-center cursor-pointer group">
              <input
                id="csv-file-uploader"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                <span className="text-xs font-medium text-slate-300">Choose CSV or TXT file</span>
                <span className="text-[10px] text-slate-500">First column should contain recipient names</span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 bg-red-950/20 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Recipients Summary Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Total Queue</span>
                <h4 className="text-sm font-extrabold text-slate-200">{recipients.length} Recipient(s)</h4>
              </div>
            </div>
          </div>

          {/* Export Formats Selector */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Output Compilation Format</span>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg font-sans font-bold">
              <button
                onClick={() => setOutputFormat("pdf")}
                className={`py-1 text-xs rounded transition-all cursor-pointer ${
                  outputFormat === "pdf"
                    ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                PDF Document
              </button>
              <button
                onClick={() => setOutputFormat("png")}
                className={`py-1 text-xs rounded transition-all cursor-pointer ${
                  outputFormat === "png"
                    ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                PNG Image
              </button>
            </div>
          </div>

<div className="mt-3">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Output Resolution</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg font-sans font-bold mt-1">
                <button
                  onClick={() => setOutputResolution("low")}
                  className={`py-1 text-[10px] rounded transition-all cursor-pointer ${
                    outputResolution === "low"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Low
                </button>
                <button
                  onClick={() => setOutputResolution("standard")}
                  className={`py-1 text-[10px] rounded transition-all cursor-pointer ${
                    outputResolution === "standard"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setOutputResolution("high")}
                  className={`py-1 text-[10px] rounded transition-all cursor-pointer ${
                    outputResolution === "high"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  High
                </button>
              </div>
            </div>
          

<div className="mt-3">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                File Name Prefix
              </span>
              <input
                type="text"
                value={fileNamePrefix}
                onChange={(e) => setFileNamePrefix(e.target.value)}
                placeholder="e.g. certificate"
                className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
              />
              <p className="text-[9px] text-slate-500 mt-1 truncate">Output: {fileNamePrefix || "certificate"}_JohnDoe.{outputFormat}</p>
            </div>          {/* Batch action buttons */}
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                id="bulk-generate-zip-btn"
                disabled={isCompiling || recipients.length === 0}
                onClick={downloadAllAsZip}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isCompiling && compilationType === "zip" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>ZIP ({outputFormat.toUpperCase()})</span>
              </button>
              
              <button
                disabled={isCompiling || recipients.length === 0 || !gdriveReady}
                onClick={() => handleSaveToDrive("zip")}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Save ZIP to Drive</span>
              </button>
            </div>

            {recipients.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  id="combined-pdf-btn"
                  disabled={isCompiling}
                  onClick={downloadCombinedPdf}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-emerald-400 text-[11px] font-bold rounded-lg shadow transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  title="Combine all certificates as pages in a single PDF"
                >
                  {isCompiling && compilationType === "combined" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Combined PDF</span>
                </button>
                
                <button
                  disabled={isCompiling || !gdriveReady}
                  onClick={() => handleSaveToDrive("combined")}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-950 border border-blue-900 hover:bg-blue-900 text-blue-400 text-[11px] font-bold rounded-lg shadow transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Save PDF to Drive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Right Output: Real-time Live Preview Rendering */}
      <div className="xl:col-span-8 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-2.5 gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Visual Quality Inspector</h3>
                <p className="text-[10px] text-slate-500 font-medium">Preview and approve final generated canvas renders.</p>
              </div>
            </div>

            {/* Recipient Selector Slider/Controls */}
            {recipients.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 rounded-lg p-1 w-fit self-end sm:self-auto">
                <button
                  id="preview-prev-btn"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                >
                  ◀
                </button>
                <span className="text-xs font-mono font-bold text-slate-300 px-1">
                  {currentIndex + 1} / {recipients.length}
                </span>
                <button
                  id="preview-next-btn"
                  disabled={currentIndex === recipients.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(recipients.length - 1, prev + 1))}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Render Area */}
          <div className="relative aspect-[4/3] w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-slate-800 shadow bg-slate-950 flex items-center justify-center">
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Certificate Preview"
                  className="w-full h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                
                {/* Floating single-download button */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button
                    id="single-recipient-download-btn"
                    onClick={() => downloadSingle(recipients[currentIndex], outputFormat)}
                    className="bg-slate-900/95 hover:bg-slate-800 text-emerald-400 border border-slate-800 px-3.5 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download {outputFormat.toUpperCase()}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 text-slate-700 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Rendering premium visual...</span>
              </div>
            )}
          </div>

          {/* Active compiling modal screen over editor */}
          {isCompiling && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4 mx-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-950 text-emerald-400 rounded-full animate-pulse">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase font-bold text-slate-300 tracking-wider">
                      {compilationType === "zip" ? "Assembling ZIP Archive..." : "Generating Combined PDF..."}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Rendering high-resolution vector and text layouts.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold font-mono text-slate-400">
                    <span>Progress</span>
                    <span>{compileProgress.current} / {compileProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(compileProgress.current / compileProgress.total) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 text-center italic">
                  "Laying out certificate fields and assembling outputs..."
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Small List View of All Recipients */}
        {recipients.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Recipients Queue Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {recipients.map((rec, index) => (
                <button
                  id={`queue-item-${index}`}
                  key={rec.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                    index === currentIndex 
                      ? "bg-slate-950 border-emerald-500/50 font-semibold text-emerald-400" 
                      : "bg-slate-950/40 border-slate-800 hover:bg-slate-950 text-slate-400"
                  }`}
                >
                  <span className="truncate pr-1">#{index + 1}: {rec.name}</span>
                  {index === currentIndex && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
