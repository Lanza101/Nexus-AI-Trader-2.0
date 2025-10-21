import React from 'react';
import { Dashboard } from './components/Dashboard';
import InstallAppBanner from './components/InstallAppBanner';

const App: React.FC = () => {
  return (
    <>
      <InstallAppBanner />
      <div className="min-h-screen bg-gray-900 font-sans pb-8">
        <header className="bg-gray-800 p-4 border-b border-gray-700 text-center">
          <h1 className="text-2xl font-bold text-white">
            Nexus AI Trader
          </h1>
          <p className="text-sm text-gray-400 mt-1">AI-Powered Market Analysis</p>
        </header>
        <main className="p-4 md:p-8">
          <Dashboard />
        </main>
      </div>
    </>
  );
};

export default App;
