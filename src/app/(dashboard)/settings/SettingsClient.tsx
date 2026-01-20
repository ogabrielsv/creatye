"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// --- Components ---
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Zm5.25-2.1a.9.9 0 1 1 0 1.8a.9.9 0 0 1 0-1.8Z"
      />
    </svg>
  );
}

export default function SettingsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "geral";
  const connected = searchParams.get("ig");
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ connected: boolean; ig_username?: string } | null>(null);
  const [checking, setChecking] = useState(true);

  // Status message logic
  const statusMsg = useMemo(() => {
    if (connected === "conectado") return { type: "success", text: "Instagram conectado com sucesso! ✅" };
    if (error) return { type: "error", text: `Erro ao conectar: ${decodeURIComponent(error)}` };
    return null;
  }, [connected, error]);

  // Fetch initial status
  useEffect(() => {
    fetch('/api/instagram/status')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const onConnect = () => {
    setLoading(true);
    // Use new dedicated connect route
    window.location.href = "/api/instagram/connect";
  };

  const onDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Instagram? Automações irão parar de funcionar.")) return;
    setLoading(true);
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST' });
      if (res.ok) {
        setData({ connected: false });
        router.refresh();
      }
    } catch (e) {
      alert("Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="p-8 text-center opacity-50">Carregando configurações...</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Configurações</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>Gerencie suas integrações e preferências.</p>

      {/* Tabs Placeholder */}
      <div className="flex gap-4 mb-8 border-b border-white/10 pb-1">
        <button
          className={`pb-2 px-1 ${tab === 'geral' ? 'border-b-2 border-white font-bold' : 'opacity-60'}`}
          onClick={() => router.push('/settings?tab=geral')}
        >
          Geral
        </button>
        <button
          className={`pb-2 px-1 ${tab === 'integracoes' ? 'border-b-2 border-white font-bold' : 'opacity-60'}`}
          onClick={() => router.push('/settings?tab=integracoes')}
        >
          Integrações
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: statusMsg.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: statusMsg.type === "success" ? "#4ade80" : "#f87171",
            fontWeight: 500
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Instagram Card */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          padding: 24,
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <InstagramIcon className="text-pink-500" />
              <h2 className="text-lg font-bold">Instagram Business</h2>
            </div>

            {data?.connected ? (
              <div className="mt-2">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 block"></span>
                  Conectado como @{data.ig_username || 'Usuário'}
                </p>
                <p className="text-sm opacity-60 mt-1">Suas automações de DM estão ativas.</p>
              </div>
            ) : (
              <p className="text-sm opacity-70 max-w-md mt-1">
                Conecte sua conta profissional para permitir que o sistema responda DMs e comentários automaticamente.
              </p>
            )}
          </div>

          <div>
            {data?.connected ? (
              <button
                onClick={onDisconnect}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm font-medium text-red-400 transition-colors"
              >
                {loading ? "Processando..." : "Desconectar"}
              </button>
            ) : (
              <button
                onClick={onConnect}
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: "12px 20px",
                  borderRadius: 12,
                  color: "white",
                  fontWeight: 600,
                  fontSize: 15,
                  background:
                    "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                  boxShadow: "0 4px 15px rgba(220, 39, 67, 0.3)",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <InstagramIcon />
                {loading ? "Conectando..." : "Conectar Instagram"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
