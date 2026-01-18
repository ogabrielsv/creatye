'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Instagram, LogOut, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [connection, setConnection] = useState<any>(null);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        checkConnection();

        // Handle URL params
        const error = searchParams.get('error');
        const success = searchParams.get('success');

        if (success === 'connected') {
            toast.success('Instagram conectado com sucesso!');
            // Clean URL
            router.replace('/settings');
        } else if (error) {
            toast.error(`Erro na conexão: ${error}`);
            router.replace('/settings');
        }
    }, []);

    const checkConnection = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('ig_connections')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setConnection(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        window.location.href = '/api/meta/connect';
    };

    const handleDisconnect = async () => {
        if (!confirm('Tem certeza que deseja desconectar? Automações irão parar de funcionar.')) return;

        try {
            const { error } = await supabase
                .from('ig_connections')
                .delete()
                .eq('user_id', connection.user_id); // ensuring RLS check

            if (error) throw error;

            setConnection(null);
            toast.success('Desconectado.');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao desconectar.');
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-6">Configurações</h1>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Conexão com Instagram</h2>
                        <p className="text-zinc-400 text-sm">Conecte sua conta Business para ativar automações.</p>
                    </div>
                </div>

                {connection ? (
                    <div className="bg-brand-500/5 border border-brand-500/20 rounded-lg p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
                                <Instagram className="w-6 h-6 text-pink-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">@{connection.username}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-brand-400" />
                                    <span className="text-brand-400 text-xs font-medium">Conectado e Ativo</span>
                                    <span className="text-zinc-600 text-xs ml-2">ID: {connection.ig_user_id}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 font-medium transition-colors flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Desconectar
                        </button>
                    </div>
                ) : (
                    <div className="bg-zinc-950/50 border border-zinc-800/50 border-dashed rounded-lg p-8 text-center">
                        <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Instagram className="w-6 h-6 text-zinc-500" />
                        </div>
                        <h3 className="text-zinc-300 font-medium mb-2">Nenhuma conta conectada</h3>
                        <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
                            Para usar as automações, você precisa conectar uma conta do Instagram Business vinculada a uma Página do Facebook.
                        </p>
                        <button
                            id="btn-connect-instagram"
                            onClick={handleConnect}
                            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-brand-500/10 flex items-center gap-2 mx-auto"
                        >
                            <Instagram className="w-4 h-4" />
                            Conectar Instagram
                        </button>
                    </div>
                )}

                {/* Warning about Token Expiry if close */}
                {connection && new Date(connection.token_expires_at) < new Date(Date.now() + 86400000 * 3) && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <p className="text-yellow-500 text-sm">Seu token de acesso expira em breve. Reconecte para renovar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
