import { useEffect, useState, useCallback } from "react";
import { useGoogleAuth } from "./useGoogleAuth";

export function useGooglePicker() {
  const { token, login, isReady: authReady } = useGoogleAuth();
  const [pickerReady, setPickerReady] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    // We can infer appId from Google Client ID (the first part before the dash)
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        if (data.googleClientId) {
          setAppId(data.googleClientId.split('-')[0]);
        }
      })
      .catch(console.error);

    // Load Google Picker API
    if (!document.querySelector(`script[src="https://apis.google.com/js/api.js"]`)) {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => {
        (window as any).gapi.load('picker', {
          callback: () => setPickerReady(true)
        });
      };
      document.head.appendChild(script);
    } else if ((window as any).google?.picker) {
      setPickerReady(true);
    }
  }, []);

  const openPicker = useCallback(async (): Promise<string | null> => {
    return new Promise(async (resolve, reject) => {
      try {
        let currentToken = token;
        if (!currentToken) {
          currentToken = await login();
        }
        
        if (!currentToken) {
          reject(new Error("Failed to get token"));
          return;
        }

        if (!pickerReady || !(window as any).google?.picker || !appId) {
          reject(new Error("Picker API not ready or App ID missing"));
          return;
        }

        const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.DOCS)
          .setMimeTypes("image/png,image/jpeg,image/jpg");

        const picker = new (window as any).google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(currentToken)
          .setAppId(appId)
          .setCallback((data: any) => {
            if (data[((window as any).google.picker.Response.ACTION)] == ((window as any).google.picker.Action.PICKED)) {
              const doc = data[((window as any).google.picker.Response.DOCUMENTS)][0];
              const fileId = doc[((window as any).google.picker.Document.ID)];
              
              // We have the file ID, now we need to download it or get its content.
              // Since it's an image, we can fetch it via the Drive API.
              fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                  Authorization: `Bearer ${currentToken}`
                }
              })
              .then(res => res.blob())
              .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve(reader.result as string); // Returns base64
                };
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsDataURL(blob);
              })
              .catch(reject);
            } else if (data[((window as any).google.picker.Response.ACTION)] == ((window as any).google.picker.Action.CANCEL)) {
              resolve(null);
            }
          })
          .build();
        
        picker.setVisible(true);
      } catch (err) {
        reject(err);
      }
    });
  }, [token, login, pickerReady, appId]);

  return { openPicker, isReady: authReady && pickerReady };
}
