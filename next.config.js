/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["ethers", "@avnu/avnu-sdk"],
}

module.exports = nextConfig
