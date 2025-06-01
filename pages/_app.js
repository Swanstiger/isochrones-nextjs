// pages/_app.js
import '../styles/globals.css'; // (si tenías algún CSS global adicional, de lo contrario puedes dejarlo vacío)

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;
