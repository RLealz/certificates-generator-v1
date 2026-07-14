const fs = require('fs');
let code = fs.readFileSync('src/components/BatchProcessor.tsx', 'utf-8');

code = code.replace(
  '</div>\n\n          {/* Batch action buttons */}',
  '\n\n          {/* Batch action buttons */}'
);

fs.writeFileSync('src/components/BatchProcessor.tsx', code);
