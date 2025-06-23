import React, { useEffect } from 'react';
// The import path is changed to the virtual module, which is the most stable method.
import { registerSW } from 'virtual:pwa-register';
import Icon from './Icon.jsx';

function ReloadPrompt() {
  // The registerSW function returns an update function and we can use it to register the SW.
  // The 'autoUpdate' in vite.config.js means we don't need to manage state here.
  // The function will automatically handle showing a prompt when needed if you configure it.
  // For simplicity and to fix the build, we will let the auto-update mechanism handle it.
  // The component can be simplified or enhanced later if custom UI is needed.
  
  useEffect(() => {
    // registerSW will be called once and will handle updates automatically.
    // We can provide callbacks here if we want to add custom logic.
    const updateSW = registerSW({
      onNeedRefresh() {
        // You can add a toast or modal here to ask the user to reload.
        if (confirm('New content is available, do you want to reload?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        // You can add a toast to notify the user the app can work offline.
        console.log('App is ready to work offline');
      },
    });
  }, []);

  // This component will no longer render any UI itself,
  // it will just register the service worker and use browser confirms.
  // You can build out a custom UI here using state if you prefer.
  return null;
}

export default ReloadPrompt;