/** @type {import('next').NextConfig} */
const nextConfig = {
    
    webpack: (config, { isServer }) => {
      config.module.exprContextCritical = false;
      return config;
    },
  };

module.exports = nextConfig;
