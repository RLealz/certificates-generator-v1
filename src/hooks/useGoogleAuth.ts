import { useEffect, useState, useCallback } from "react";

export function useGoogleAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        if (data.googleClientId) {
          setClientId(data.googleClientId);
        }
      })
      .catch(console.error);

    // Load GIS script
    if (!document.querySelector(`script[src="https://accounts.google.com/gsi/client"]`)) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const login = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!clientId) {
        reject(new Error("Google Client ID not configured"));
        return;
      }
      if (!(window as any).google) {
        reject(new Error("Google Identity Services not loaded"));
        return;
      }
      
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          setToken(response.access_token);
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    });
  }, [clientId]);

  const saveToDrive = async (accessToken: string, blob: Blob, filename: string, mimeType: string) => {
    const metadata = {
      name: filename,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });
    
    if (!res.ok) {
      throw new Error(`Google Drive API error: ${res.statusText}`);
    }
    
    return res.json();
  };

  return { token, login, saveToDrive, isReady: !!clientId };
}
