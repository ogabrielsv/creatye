'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <h2 className="text-xl font-bold text-red-600">Algo deu errado!</h2>
            <p className="text-zinc-600">{error.message || 'Erro desconhecido.'}</p>
            <button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                Tentar novamente
            </button>
        </div>
    );
}
