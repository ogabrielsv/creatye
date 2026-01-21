"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
  const isDev = process.env.NODE_ENV !== 'production';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ connected: boolean; ig_username?: string } | null>(null);
  const [checking, setChecking] = useState(true);

  // Status message logic
  const statusMsg = useMemo(() => {
    if (connected === "connected") return { type: "success", text: "Instagram conectado com sucesso!" };
    if (error) return { type: "error", text: decodeURIComponent(error) };
    return null;
  }, [connected, error]);

  const fetchStatus = () => {
    setChecking(true);
    fetch('/api/instagram/status') // reusing status for basic display check if compatible, else update
      .then(r => r.json())
      .then(d => {
        setData(d);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  };

  useEffect(() => {
    fetchStatus();
  }, [connected]);

  const onConnect = () => {
    setLoading(true);
    // Directly go to new connect route that does validation
    window.location.href = "/api/instagram/connect";
  };

  const onDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Instagram?")) return;
    setLoading(true);
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST' });
      if (res.ok) {
        setData({ connected: false });
        router.push('/settings?tab=integracoes');
      } else {
        alert("Erro ao desconectar");
      }
    } catch (e) {
      alert("Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  if (checking && !data) {
    return (
      <div className="p-8 flex items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
        <span className="text-white/50">Carregando...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">Configurações</h1>
      </div>
      <p className="opacity-70 mb-8">Gerencie suas integrações e preferências.</p>

      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-white/10">
        <button
          className={`pb-3 px-1 transition-colors ${tab === 'geral' ? 'border-b-2 border-white font-semibold text-white' : 'opacity-60 hover:opacity-100 hover:text-white'}`}
          onClick={() => router.push('/settings?tab=geral')}
        >
          Geral
        </button>
        <button
          className={`pb-3 px-1 transition-colors ${tab === 'integracoes' ? 'border-b-2 border-white font-semibold text-white' : 'opacity-60 hover:opacity-100 hover:text-white'}`}
          onClick={() => router.push('/settings?tab=integracoes')}
        >
          Integrações
        </button>
      </div>

      {tab === 'integracoes' ? (
        <div className="space-y-6">
          {statusMsg && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${statusMsg.type === "success"
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
            >
              <div className="mt-0.5 font-bold">
                {statusMsg.type === 'success' ? 'Sucesso:' : 'Atenção:'}
              </div>
              <div>{statusMsg.text}</div>
            </div>
          )}

          {/* Instagram Card */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/[0.07]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-lg shadow-pink-900/20">
                    <InstagramIcon className="text-white" />
                  </div>
                  <h2 className="text-lg font-bold">Instagram</h2>
                </div>

                {data?.connected ? (
                  <div className="mt-3 pl-[52px]">
                    <p className="text-green-400 font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 block animate-pulse"></span>
                      Conectado como @{data.ig_username || 'Usuário'}
                    </p>
                    <p className="text-sm opacity-60 mt-1">Sua conta está conectada para automações de mídia.</p>
                  </div>
                ) : (
                  <p className="text-sm opacity-70 max-w-md mt-2 pl-[52px]">
                    Conecte sua conta para habilitar automações.
                  </p>
                )}
              </div>

              <div className="mt-2">
                {data?.connected ? (
                  <button
                    onClick={onDisconnect}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-sm font-medium text-red-400 transition-colors flex items-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? "Processando..." : "Desconectar"}
                  </button>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <InstagramIcon />
                        Entrar com Instagram
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 opacity-50">
          <p>Configurações gerais em breve.</p>
        </div>
      )}
    </div>
  );
}
