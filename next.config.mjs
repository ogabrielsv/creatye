/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'scontent.cdninstagram.com' },
            { protocol: 'https', hostname: 'instagram.fbsbx.com' },
            { protocol: 'https', hostname: 'scontent.xx.fbcdn.net' },
            { protocol: 'https', hostname: '*.cdninstagram.com' },
            { protocol: 'https', hostname: '*.fbcdn.net' },
        ],
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
