import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export function PostSelector({ onSelect, selectedId }: { onSelect: (id: string) => void, selectedId?: string }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('/api/instagram/media')
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setPosts(data.data);
                } else if (data.error) {
                    setError('Erro ao carregar posts: ' + data.error);
                }
            })
            .catch(err => setError('Erro de conexão'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-sm text-zinc-500 animate-pulse">Carregando publicações do Instagram...</div>;
    if (error) return <div className="text-sm text-red-500">{error}</div>;

    if (posts.length === 0) return <div className="text-sm text-zinc-500">Nenhuma publicação encontrada.</div>;

    return (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 border border-zinc-200 rounded-lg bg-white">
            {posts.map(post => (
                <div
                    key={post.id}
                    onClick={() => onSelect(post.id)}
                    className={`relative cursor-pointer aspect-square bg-zinc-100 rounded overflow-hidden group border-2 ${selectedId === post.id ? 'border-brand-500' : 'border-transparent hover:border-zinc-300'}`}
                >
                    {post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL_ALBUM' ? (
                        <img src={post.media_url || post.thumbnail_url} alt="post" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black">
                            {post.thumbnail_url ? (
                                <img src={post.thumbnail_url} alt="video thumb" className="w-full h-full object-cover opacity-80" />
                            ) : (
                                <span className="text-white text-xs">VIDEO</span>
                            )}
                        </div>
                    )}
                    {selectedId === post.id && (
                        <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                                <Check size={14} className="text-white" />
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
