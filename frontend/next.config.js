/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  // REQUIRED for your Dockerfile
  output: 'standalone',

  images: {
    domains: ['localhost'],
  },
};