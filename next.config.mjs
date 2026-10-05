/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // googleapis es pesado; se deja fuera del bundle de servidor.
    serverComponentsExternalPackages: ['googleapis'],
  },
};

export default nextConfig;
