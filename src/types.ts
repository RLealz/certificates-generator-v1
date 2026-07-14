export interface CertificateField {
  id: string;
  name: string;
  type?: "text" | "image"; // text by default
  text: string;
  src?: string; // image source (base64 or URL)
  opacity?: number; // for watermarks or general opacity
  x: number; // percentage from 0 to 100
  y: number; // percentage from 0 to 100
  width?: number; // width in px or percentage
  height?: number; // height in px or percentage
  backgroundColor?: string; // hex code or transparent
  blendMode?: "normal" | "multiply"; // For blending images (like removing white backgrounds)
  fontSize: number; // pixel size relative to 800px standard width
  color: string; // hex code
  alignment: "left" | "center" | "right";
  fontFamily: "Inter" | "Cinzel" | "Playfair Display" | "Space Grotesk" | "JetBrains Mono" | "Montserrat";
  isDynamic: boolean;
  placeholderKey: "recipientName" | "workshopTitle" | "date" | "hours" | "issuerName" | "custom";
}

export interface CertificateTemplate {
  id: string;
  name: string;
  backgroundUrl: string;
  fields: CertificateField[];
}

export interface Recipient {
  id: string;
  name: string;
  email?: string;
  customFields?: Record<string, string>;
}
