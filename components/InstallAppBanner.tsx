import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if the device is iOS (iPhone, iPad, iPod)
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if the PWA is already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isInstalled) {
      const handler = (e: any) => {
        // Prevent Chrome 76 and later from showing the mini-infobar.
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e);
        // Show our custom banner
        setShowBanner(true);
      };

      // Listen for the event that indicates the app is installable
      window.addEventListener('beforeinstallprompt', handler);

      // On iOS, the 'beforeinstallprompt' event doesn't fire, so we just show the instructions banner after a delay
      if (iOS) {
        setTimeout(() => setShowBanner(true), 2000);
      }

      // Cleanup function
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, show the custom instructions modal
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      // Show the native browser installation prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      // If the user accepts, hide the banner
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      
      // We can only call prompt() once, so reset the event
      setDeferredPrompt(null);
    }
  };

  const handleClose = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Main Install Banner (fixed at the bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="max-w-md mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-4 border-2 border-white/20 relative">
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="flex-shrink-0">
              <img 
                src="/app-icon-192.png" 
                alt="Nexus AI Trader" 
                className="w-16 h-16 rounded-2xl shadow-lg"
              />
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg mb-1">
                Install Nexus AI Trader
              </h3>
              <p className="text-blue-100 text-sm mb-3">
                Add to your home screen for quick access
              </p>
              
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-all shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isIOS ? 'Show Instructions' : 'Install App'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Install App</h3>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  1
                </div>
                <div>
                  <p className="text-gray-700">
                    Tap the <strong>Share</strong> button at the bottom of Safari
                  </p>
                  <div className="mt-2 text-3xl">⬆️</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  2
                </div>
                <div>
                  <p className="text-gray-700">
                    Scroll and tap <strong>"Add to Home Screen"</strong>
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  3
                </div>
                <div>
                  <p className="text-gray-700">
                    Tap <strong>"Add"</strong> to install
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
