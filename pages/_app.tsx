import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../src/styles.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>TODO Service</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}

