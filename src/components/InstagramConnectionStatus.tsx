'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Plus, Instagram } from 'lucide-react';
import Image from 'next/image';

interface ConnectionData {
    connected: boolean;
    ig_username?: string;
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

    const fetchConnection = async () => {
        try {
            const res = await fetch('/api/ig/connection', { cache: 'no-store' });
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
            const res = await fetch('/api/ig/disconnect', { method: 'POST' });
            if (res.ok) {
                setData({ connected: false });
                router.refresh();
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
        return (
            <div className="px-4 py-3 border-b border-border/50">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border bg-zinc-200 shrink-0">
                            {data.ig_profile_picture_url ? (
                                <Image
                                    src={data.ig_profile_picture_url}
                                    alt={data.ig_username || 'Instagram'}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                    <Instagram className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">
                                @{data.ig_username}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Conectado
                            </p>
                        </div>
                    </div>

                    {showDisconnectConfirm ? (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-center text-muted-foreground">Desconectar?</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDisconnectConfirm(false)}
                                    className="flex-1 px-2 py-1 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={isDisconnecting}
                                    className="flex-1 px-2 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-1"
                                >
                                    {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowDisconnectConfirm(true)}
                            className="w-full mt-1 text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center justify-center gap-1 py-1"
                        >
                            <LogOut className="w-3 h-3" />
                            Desconectar
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Not connected
    return (
        <div className="px-4 py-3 border-b border-border/50">
            <a
                href="/api/meta/connect"
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all group"
            >
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-brand-500 transition-colors">
                    <Plus className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Conectar Instagram
                    </p>
                </div>
            </a>
        </div>
    );
}
