const fs = require('fs');
let code = fs.readFileSync('src/components/BatchProcessor.tsx', 'utf-8');

code = code.replace(
  'const [outputFormat, setOutputFormat] = useState<"png" | "pdf">("pdf"); // Default to PDF as requested',
  'const [outputFormat, setOutputFormat] = useState<"png" | "pdf">("pdf");\n  const [outputResolution, setOutputResolution] = useState<"standard" | "high" | "low">("standard");\n\n  const getCanvasDimensions = () => {\n    switch (outputResolution) {\n      case "low": return { w: 800, h: 600 };\n      case "high": return { w: 2400, h: 1800 };\n      case "standard": default: return { w: 1600, h: 1200 };\n    }\n  };'
);

code = code.replace(
  'const outputFontSize = field.fontSize * 2;',
  'const outputFontSize = field.fontSize * (canvas.width / 800);'
);

// We need to replace all occurrences of `canvas.width = 1600;` and `canvas.height = 1200;`
// Except in `useEffect` where it might not have access to state if not in deps, wait, it has access.
// Let's replace the hardcoded ones.
code = code.replace(
  /canvas\.width = 1600;\s*canvas\.height = 1200;/g,
  'const dims = getCanvasDimensions();\n      canvas.width = dims.w;\n      canvas.height = dims.h;'
);

// The UI for resolution selector
const resolutionUi = `
            <div className="mt-3">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Output Resolution</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg font-sans font-bold mt-1">
                <button
                  onClick={() => setOutputResolution("low")}
                  className={\`py-1 text-[10px] rounded transition-all cursor-pointer \${
                    outputResolution === "low"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }\`}
                >
                  Low
                </button>
                <button
                  onClick={() => setOutputResolution("standard")}
                  className={\`py-1 text-[10px] rounded transition-all cursor-pointer \${
                    outputResolution === "standard"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }\`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setOutputResolution("high")}
                  className={\`py-1 text-[10px] rounded transition-all cursor-pointer \${
                    outputResolution === "high"
                      ? "bg-slate-900 text-emerald-400 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }\`}
                >
                  High
                </button>
              </div>
            </div>
`;

code = code.replace(
  '          {/* Batch action buttons */}',
  resolutionUi.trim() + '\n          </div>\n\n          {/* Batch action buttons */}'
);
// wait, the format selector closes with a div... 
// let's do a better replace for UI.

fs.writeFileSync('src/components/BatchProcessor.tsx', code);
