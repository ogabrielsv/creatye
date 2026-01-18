import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <h2 className="text-4xl font-bold">404</h2>
            <p className="text-zinc-600">Página não encontrada</p>
            <Link href="/" className="text-blue-600 hover:underline">
                Voltar para o início
            </Link>
        </div>
    );
}
