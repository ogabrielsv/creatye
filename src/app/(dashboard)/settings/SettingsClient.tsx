"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SettingsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "geral";
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (connected) {
      setTimeout(() => {
        // Clean URL
        router.replace('/settings');
      }, 3000);
    }
  }, [connected, router]);

  const handleConnect = () => {
    setIsLoading(true);
    // Redirect to our secure login route which handles State generation
    window.location.href = "/api/meta/login";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Configurações</h1>
      </div>

      {/* Status Messages */}
      {connected && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          Conta do Instagram conectada com sucesso!
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Erro ao conectar: {decodeURIComponent(error)}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-white">Integrações</h2>

        <div className="flex items-center justify-between p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="flex items-center space-x-4">
            {/* Instagram Icon */}
            <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            </div>
            <div>
              <h3 className="font-medium text-white">Instagram Business</h3>
              <p className="text-sm text-zinc-400">Conecte sua conta para habilitar automações de DM.</p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={isLoading || !!connected}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${connected
                ? "bg-green-500/10 text-green-500 cursor-default border border-green-500/20"
                : "bg-white text-black hover:bg-gray-200"
              }`}
          >
            {isLoading ? "Conectando..." : connected ? "Conectado" : "Conectar Instagram"}
          </button>
        </div>
      </div>
    </div>
  );
}
