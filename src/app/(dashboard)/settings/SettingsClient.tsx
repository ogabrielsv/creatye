"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Zm5.25-2.1a.9.9 0 1 1 0 1.8a.9.9 0 0 1 0-1.8Z"
      />
    </svg>
  );
}

export default function SettingsClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "geral";
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(false);

  const statusMsg = useMemo(() => {
    if (connected === "1") return { type: "success", text: "Instagram conectado com sucesso ✅" };
    if (error) return { type: "error", text: `Erro ao conectar: ${decodeURIComponent(error)}` };
    return null;
  }, [connected, error]);

  const onConnect = () => {
    setLoading(true);
    // Rota de login do seu OAuth (vamos criar/garantir no backend)
    window.location.href = "/api/meta/login";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Configurações</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>Aba: {tab}</p>

      {statusMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: statusMsg.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          }}
        >
          {statusMsg.text}
        </div>
      )}

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          padding: 16,
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Instagram</div>
          <div style={{ opacity: 0.8, fontSize: 14 }}>
            Conecte sua conta para permitir responder DM/Story automaticamente.
          </div>
        </div>

        <button
          onClick={onConnect}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            padding: "12px 16px",
            borderRadius: 14,
            color: "white",
            fontWeight: 700,
            background:
              "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            opacity: loading ? 0.7 : 1,
            minWidth: 220,
            justifyContent: "center",
          }}
        >
          <InstagramIcon />
          {loading ? "Conectando..." : "Conectar Instagram"}
        </button>
      </div>
    </div>
  );
}
