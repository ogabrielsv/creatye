'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Instagram } from 'lucide-react';
import Image from 'next/image';

interface ConnectionData {
    connected: boolean;
    ig_username?: string;
    ig_name?: string;
    ig_profile_picture_url?: string;
    ig_business_account_id?: string;
    updated_at?: string;
}

export function InstagramConnectionStatus() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ConnectionData | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [imgError, setImgError] = useState(false);

    const fetchConnection = async () => {
        try {
            const res = await fetch('/api/meta/connection', { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Failed to fetch IG connection', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnection();
    }, []);

    const handleDisconnect = async () => {
        try {
            setIsDisconnecting(true);
            const res = await fetch('/api/meta/disconnect', { method: 'POST' });
            if (res.ok) {
                setData({ connected: false });
                router.refresh();
                // Force reload to ensure all gates update
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to disconnect', error);
        } finally {
            setIsDisconnecting(false);
            setShowDisconnectConfirm(false);
        }
    };

    if (loading) {
        return (
            <div className="px-6 py-4 border-b border-border/50 animate-pulse">
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-full"></div>
            </div>
        );
    }

    if (data?.connected) {
        const profilePic = data.ig_profile_picture_url;
        const fallbackInitial = (data.ig_username || '?').charAt(0).toUpperCase();

        return (
            <div className="px-4 py-3 border-b border-border/50">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border bg-zinc-200 shrink-0 flex items-center justify-center text-zinc-500 font-bold">
                            {profilePic && !imgError ? (
                                <Image
                                    src={profilePic}
                                    alt={data.ig_username || 'Instagram'}
                                    fill
                                    className="object-cover"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <span>{fallbackInitial}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-foreground">
                                {data?.ig_name || data?.ig_username}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                @{data?.ig_username}
                            </p>
                        </div>
                    </div>

                    {showDisconnectConfirm ? (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-center text-muted-foreground">Desconectar conta?</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDisconnectConfirm(false)}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={isDisconnecting}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-1"
                                >
                                    {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim, sair'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowDisconnectConfirm(true)}
                            className="w-full mt-1 text-xs font-medium text-muted-foreground hover:text-red-500 transition-colors flex items-center justify-center gap-1 py-1"
                        >
                            <LogOut className="w-3 h-3" />
                            Desconectar
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Not connected - Compact Sidebar Button
    return (
        <div className="px-4 py-3 border-b border-border/50">
            <a
                href="/api/meta/connect"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg hover:opacity-90 active:scale-95"
                style={{
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                }}
            >
                <Instagram className="w-4 h-4" />
                Conectar Instagram
            </a>
        </div>
    );
}
