import dynamic from 'next/dynamic';
import React from 'react';

const App = dynamic(() => import('../src/index').then(m => m.default), { ssr: false });

export default function IndexPage() {
  return <App />;
}

