import { CertificateTemplate, CertificateField } from "../types";

// Helper to create an SVG data URL for crisp, high-res certificate backgrounds
function createSvgBackground(svgContent: string): string {
  const cleanSvg = svgContent.trim().replace(/\n/g, "").replace(/"/g, "'");
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
}

// 1. Classic Ivory & Gold SVG
const classicIvorySvg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>
  <!-- Rich Ivory Background -->
  <rect width='800' height='600' fill='#fdfbf7' />
  
  <!-- Outer Gold Border -->
  <rect x='20' y='20' width='760' height='560' fill='none' stroke='#d4af37' stroke-width='3' />
  <!-- Inner Thin Border -->
  <rect x='28' y='28' width='744' height='544' fill='none' stroke='#b39124' stroke-width='1' />
  
  <!-- Outer Double Line Border -->
  <rect x='40' y='40' width='720' height='520' fill='none' stroke='#2d3748' stroke-width='1.5' />
  <rect x='44' y='44' width='712' height='512' fill='none' stroke='#d4af37' stroke-dasharray='5,5' stroke-width='1' />
  
  <!-- Corner Ornaments (Gold) -->
  <!-- Top Left -->
  <path d='M 20 50 L 50 20 M 20 60 L 60 20 M 20 70 L 70 20' stroke='#d4af37' stroke-width='1.5' />
  <rect x='48' y='48' width='20' height='20' fill='none' stroke='#d4af37' stroke-width='1' />
  <!-- Top Right -->
  <path d='M 780 50 L 750 20 M 780 60 L 740 20 M 780 70 L 730 20' stroke='#d4af37' stroke-width='1.5' />
  <rect x='732' y='48' width='20' height='20' fill='none' stroke='#d4af37' stroke-width='1' />
  <!-- Bottom Left -->
  <path d='M 20 550 L 50 580 M 20 540 L 60 580 M 20 530 L 70 580' stroke='#d4af37' stroke-width='1.5' />
  <rect x='48' y='532' width='20' height='20' fill='none' stroke='#d4af37' stroke-width='1' />
  <!-- Bottom Right -->
  <path d='M 780 550 L 750 580 M 780 540 L 740 580 M 780 530 L 730 580' stroke='#d4af37' stroke-width='1.5' />
  <rect x='732' y='532' width='20' height='20' fill='none' stroke='#d4af37' stroke-width='1' />
  
  <!-- Certificate Guilloche Rosette Badge (Bottom-Center-Leftish or Rightish, typically Bottom Center) -->
  <g transform='translate(400, 480)' opacity='0.85'>
    <!-- Gold Rosette starburst -->
    <circle r='32' fill='none' stroke='#d4af37' stroke-width='1.5' stroke-dasharray='4,2' />
    <circle r='28' fill='none' stroke='#b39124' stroke-width='1' />
    <polygon points='0,-25 7,-10 22,-14 12,1 24,11 8,14 10,30 -4,19 -16,26 -13,10 -25,0 -10,-6' fill='#d4af37' opacity='0.3' />
    <!-- Ribbon tails -->
    <path d='M-15,15 L-25,55 L-10,50 L0,55 L-5,15' fill='#b39124' opacity='0.7' />
    <path d='M15,15 L25,55 L10,50 L0,55 L5,15' fill='#d4af37' opacity='0.7' />
    <!-- Center Seal circle -->
    <circle r='22' fill='#fdfbf7' stroke='#b39124' stroke-width='2' />
    <circle r='18' fill='#d4af37' />
    <text x='0' y='4' font-family='sans-serif' font-size='10' font-weight='bold' fill='#fdfbf7' text-anchor='middle'>SEAL</text>
  </g>
</svg>
`;

// 2. Modern Midnight Navy & Gold SVG
const midnightNavySvg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>
  <!-- Deep Navy Canvas -->
  <rect width='800' height='600' fill='#0f172a' />
  
  <!-- Geometric Abstract Shapes (Luxury gold & ice blue accent gradients) -->
  <!-- Bottom Right Gold Accent Triangle -->
  <polygon points='800,400 800,600 600,600' fill='#1e293b' opacity='0.5' />
  <polygon points='800,450 800,600 650,600' fill='#d4af37' opacity='0.25' />
  <polygon points='800,500 800,600 700,600' fill='#f59e0b' opacity='0.4' />
  
  <!-- Top Left Accent -->
  <polygon points='0,0 250,0 0,250' fill='#1e293b' opacity='0.5' />
  <polygon points='0,0 200,0 0,200' fill='#38bdf8' opacity='0.15' />
  <polygon points='0,0 120,0 0,120' fill='#d4af37' opacity='0.3' />
  
  <!-- Sleek borders -->
  <rect x='30' y='30' width='740' height='540' fill='none' stroke='#334155' stroke-width='2' />
  <rect x='40' y='40' width='720' height='520' fill='none' stroke='#d4af37' stroke-width='1.5' opacity='0.8' />
  
  <!-- Abstract Gold Line Accents -->
  <line x1='30' y1='100' x2='100' y2='30' stroke='#d4af37' stroke-width='2' />
  <line x1='700' y1='570' x2='770' y2='500' stroke='#d4af37' stroke-width='2' />

  <!-- Technical watermarks -->
  <circle cx='400' cy='300' r='180' fill='none' stroke='#1e293b' stroke-dasharray='10,15' stroke-width='1' />
  <circle cx='400' cy='300' r='120' fill='none' stroke='#1e293b' stroke-dasharray='5,5' stroke-width='1' />
</svg>
`;

// 3. Corporate Emerald & Platinum SVG
const emeraldPlatinumSvg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>
  <!-- Pristine Cream/White Canvas -->
  <rect width='800' height='600' fill='#f8fafc' />
  
  <!-- Left Side Emerald Color Block -->
  <rect x='0' y='0' width='60' height='600' fill='#064e3b' />
  <rect x='60' y='0' width='8' height='600' fill='#059669' />
  <rect x='68' y='0' width='4' height='600' fill='#34d399' />
  
  <!-- Gold Divider Ribbon Stripe -->
  <rect x='72' y='0' width='6' height='600' fill='#d4af37' />
  
  <!-- Platinum and Grey Grid Elements -->
  <rect x='90' y='20' width='690' height='560' fill='none' stroke='#cbd5e1' stroke-width='1' />
  <rect x='98' y='28' width='674' height='544' fill='none' stroke='#e2e8f0' stroke-dasharray='4,4' stroke-width='1.5' />
  
  <!-- Crest/Logo Placeholder on Top Left (over the Emerald section) -->
  <g transform='translate(34, 60)'>
    <circle r='18' fill='#d4af37' />
    <circle r='14' fill='#064e3b' />
    <polygon points='0,-8 3,-2 8,-2 4,2 6,8 0,4 -6,8 -4,2 -8,-2 -3,-2' fill='#d4af37' />
  </g>
</svg>
`;

// Default standard layouts for text fields (percentages of 800x600 size)
export const DEFAULT_CLASSIC_FIELDS: CertificateField[] = [
  {
    id: "header",
    name: "Certificate Header",
    text: "CERTIFICATE OF ACHIEVEMENT",
    x: 50,
    y: 20,
    fontSize: 32,
    color: "#2d3748",
    alignment: "center",
    fontFamily: "Cinzel",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "subHeader",
    name: "Presentation Statement",
    text: "THIS CERTIFICATE IS PROUDLY PRESENTED TO",
    x: 50,
    y: 32,
    fontSize: 12,
    color: "#718096",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "recipient_name",
    name: "Recipient Name",
    text: "Jane Doe",
    x: 50,
    y: 43,
    fontSize: 36,
    color: "#b39124",
    alignment: "center",
    fontFamily: "Playfair Display",
    isDynamic: true,
    placeholderKey: "recipientName",
  },
  {
    id: "achievement_text",
    name: "Achievement / Detail",
    text: "for active participation and successful completion of the intensive workshop on",
    x: 50,
    y: 53,
    fontSize: 13,
    color: "#4a5568",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "workshop_name",
    name: "Workshop Title",
    text: "Generative AI Masterclass",
    x: 50,
    y: 62,
    fontSize: 22,
    color: "#2d3748",
    alignment: "center",
    fontFamily: "Space Grotesk",
    isDynamic: false,
    placeholderKey: "workshopTitle",
  },
  {
    id: "hours_text",
    name: "Duration Hours",
    text: "Completed 16 hours of professional hands-on development",
    x: 50,
    y: 70,
    fontSize: 11,
    color: "#718096",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "hours",
  },
  {
    id: "date",
    name: "Issue Date",
    text: "October 14, 2026",
    x: 28,
    y: 82,
    fontSize: 12,
    color: "#4a5568",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "date",
  },
  {
    id: "issuer_name",
    name: "Authorized Signatory",
    text: "Google AI Developer Relations",
    x: 72,
    y: 82,
    fontSize: 12,
    color: "#4a5568",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "issuerName",
  },
];

export const DEFAULT_NAVY_FIELDS: CertificateField[] = [
  {
    id: "header",
    name: "Certificate Header",
    text: "CERTIFICATE OF COMPLETION",
    x: 50,
    y: 20,
    fontSize: 30,
    color: "#ffffff",
    alignment: "center",
    fontFamily: "Space Grotesk",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "subHeader",
    name: "Presentation Statement",
    text: "This certifies that",
    x: 50,
    y: 30,
    fontSize: 14,
    color: "#94a3b8",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "recipient_name",
    name: "Recipient Name",
    text: "Johnathan Smith",
    x: 50,
    y: 40,
    fontSize: 38,
    color: "#f59e0b",
    alignment: "center",
    fontFamily: "Space Grotesk",
    isDynamic: true,
    placeholderKey: "recipientName",
  },
  {
    id: "achievement_text",
    name: "Achievement / Detail",
    text: "has accomplished all modules and practical evaluations for",
    x: 50,
    y: 50,
    fontSize: 13,
    color: "#94a3b8",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "workshop_name",
    name: "Workshop Title",
    text: "Fullstack Architecture & Systems Web Design",
    x: 50,
    y: 60,
    fontSize: 24,
    color: "#38bdf8",
    alignment: "center",
    fontFamily: "JetBrains Mono",
    isDynamic: false,
    placeholderKey: "workshopTitle",
  },
  {
    id: "hours_text",
    name: "Duration Hours",
    text: "Valid Credential | ID: CERT-839-2026",
    x: 50,
    y: 68,
    fontSize: 11,
    color: "#64748b",
    alignment: "center",
    fontFamily: "JetBrains Mono",
    isDynamic: false,
    placeholderKey: "hours",
  },
  {
    id: "date",
    name: "Issue Date",
    text: "2026-11-20",
    x: 28,
    y: 82,
    fontSize: 12,
    color: "#cbd5e1",
    alignment: "center",
    fontFamily: "JetBrains Mono",
    isDynamic: false,
    placeholderKey: "date",
  },
  {
    id: "issuer_name",
    name: "Authorized Signatory",
    text: "Engineering Lead, DeepMind",
    x: 72,
    y: 82,
    fontSize: 12,
    color: "#cbd5e1",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "issuerName",
  },
];

export const DEFAULT_EMERALD_FIELDS: CertificateField[] = [
  {
    id: "header",
    name: "Certificate Header",
    text: "CERTIFICATE OF MERIT",
    x: 53,
    y: 20,
    fontSize: 34,
    color: "#064e3b",
    alignment: "center",
    fontFamily: "Cinzel",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "subHeader",
    name: "Presentation Statement",
    text: "Awarded to the participant",
    x: 53,
    y: 31,
    fontSize: 13,
    color: "#4b5563",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "recipient_name",
    name: "Recipient Name",
    text: "Alice Johnson",
    x: 53,
    y: 42,
    fontSize: 34,
    color: "#059669",
    alignment: "center",
    fontFamily: "Montserrat",
    isDynamic: true,
    placeholderKey: "recipientName",
  },
  {
    id: "achievement_text",
    name: "Achievement / Detail",
    text: "for outstanding performance and high honor in the curriculum",
    x: 53,
    y: 52,
    fontSize: 13,
    color: "#4b5563",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "custom",
  },
  {
    id: "workshop_name",
    name: "Workshop Title",
    text: "Leadership & Agile Product Strategies",
    x: 53,
    y: 61,
    fontSize: 22,
    color: "#064e3b",
    alignment: "center",
    fontFamily: "Montserrat",
    isDynamic: false,
    placeholderKey: "workshopTitle",
  },
  {
    id: "hours_text",
    name: "Duration Hours",
    text: "Earned 8 CPD points under executive assessment",
    x: 53,
    y: 69,
    fontSize: 11,
    color: "#6b7280",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "hours",
  },
  {
    id: "date",
    name: "Issue Date",
    text: "December 05, 2026",
    x: 32,
    y: 82,
    fontSize: 12,
    color: "#4b5563",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "date",
  },
  {
    id: "issuer_name",
    name: "Authorized Signatory",
    text: "Executive Board Principal",
    x: 74,
    y: 82,
    fontSize: 12,
    color: "#4b5563",
    alignment: "center",
    fontFamily: "Inter",
    isDynamic: false,
    placeholderKey: "issuerName",
  },
];

export const PREBUILT_TEMPLATES: CertificateTemplate[] = [
  {
    id: "classic-ivory",
    name: "Classic Ivory & Gold Border",
    backgroundUrl: createSvgBackground(classicIvorySvg),
    fields: DEFAULT_CLASSIC_FIELDS,
  },
  {
    id: "midnight-navy",
    name: "Modern Midnight Navy & Gold Geometry",
    backgroundUrl: createSvgBackground(midnightNavySvg),
    fields: DEFAULT_NAVY_FIELDS,
  },
  {
    id: "emerald-platinum",
    name: "Corporate Emerald & Platinum Striped",
    backgroundUrl: createSvgBackground(emeraldPlatinumSvg),
    fields: DEFAULT_EMERALD_FIELDS,
  },
  {
    id: "royal-crimson",
    name: "Royal Crimson & Gold Traditional",
    backgroundUrl: createSvgBackground(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>
        <rect width='800' height='600' fill='#f9f9f9' />
        <rect x='15' y='15' width='770' height='570' fill='none' stroke='#800000' stroke-width='6' />
        <rect x='25' y='25' width='750' height='550' fill='none' stroke='#d4af37' stroke-width='2' />
        
        <!-- Corner Ornaments -->
        <path d='M 15 65 L 65 15 M 785 65 L 735 15 M 15 535 L 65 585 M 785 535 L 735 585' stroke='#d4af37' stroke-width='3' fill='none' />
        <circle cx='40' cy='40' r='5' fill='#800000' />
        <circle cx='760' cy='40' r='5' fill='#800000' />
        <circle cx='40' cy='560' r='5' fill='#800000' />
        <circle cx='760' cy='560' r='5' fill='#800000' />

        <!-- Crimson Banner Top -->
        <polygon points='300,15 500,15 480,50 320,50' fill='#800000' />
        
        <!-- Signatures Lines -->
        <line x1='120' y1='500' x2='320' y2='500' stroke='#333' stroke-width='1.5' />
        <line x1='480' y1='500' x2='680' y2='500' stroke='#333' stroke-width='1.5' />
      </svg>
    `),
    fields: DEFAULT_CLASSIC_FIELDS,
  },
  {
    id: "minimalist-silver",
    name: "Minimalist Silver & White Clean",
    backgroundUrl: createSvgBackground(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>
        <rect width='800' height='600' fill='#ffffff' />
        
        <!-- Silver abstract shapes -->
        <path d='M 0 0 L 150 0 L 0 150 Z' fill='#e2e8f0' />
        <path d='M 800 600 L 650 600 L 800 450 Z' fill='#e2e8f0' />
        
        <rect x='40' y='40' width='720' height='520' fill='none' stroke='#cbd5e1' stroke-width='1' />
        
        <!-- Signature Line -->
        <line x1='300' y1='520' x2='500' y2='520' stroke='#94a3b8' stroke-width='1' />
      </svg>
    `),
    fields: DEFAULT_CLASSIC_FIELDS,
  }
];
