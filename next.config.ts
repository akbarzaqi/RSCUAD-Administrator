import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // <--- Tambahkan baris ini
  images: {
    unoptimized: true, // Diperlukan jika kamu menggunakan tag <Image /> bawaan Next.js
  },
};

export default nextConfig;
