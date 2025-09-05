/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      // Map spec-specified colon action routes to file-based handlers
      { source: '/v1/boards/:bid/columns/:cid:move', destination: '/api/v1/boards/:bid/columns/:cid/move' },
      { source: '/v1/boards/:bid/cards/:cardId:move', destination: '/api/v1/boards/:bid/cards/:cardId/move' },
      // Direct API alias to /api
      { source: '/v1/boards', destination: '/api/v1/boards' },
      { source: '/v1/boards/:bid', destination: '/api/v1/boards/:bid' },
      { source: '/v1/boards/:bid/columns', destination: '/api/v1/boards/:bid/columns' },
      { source: '/v1/boards/:bid/columns/:cid/cards', destination: '/api/v1/boards/:bid/columns/:cid/cards' },
      { source: '/v1/boards/:bid/members', destination: '/api/v1/boards/:bid/members' },
      { source: '/v1/health', destination: '/api/v1/health' },
      { source: '/v1/version', destination: '/api/v1/version' }
    ];
  }
};

module.exports = nextConfig;

