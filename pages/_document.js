// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="es">
        <Head>
          {/* —— AQUI van todas tus hojas de estilo externas —— */}
          
          {/* Tu CSS local (public/css/style.css) */}
          <link rel="stylesheet" href="/css/style.css" />

          {/* Leaflet CSS */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet/dist/leaflet.css"
          />
          {/* Leaflet Draw */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"
          />
          {/* MapTiler Geocoding CSS */}
          <link
            rel="stylesheet"
            href="https://cdn.maptiler.com/maptiler-geocoding-control/v1.3.3/style.css"
          />
          {/* DataTables CSS */}
          <link
            rel="stylesheet"
            href="https://cdn.datatables.net/2.1.6/css/dataTables.dataTables.min.css"
          />
          {/* Bootstrap CSS */}
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          />
          {/* Google Fonts Roboto */}
          <link
            href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap"
            rel="stylesheet"
          />

          {/* Favicon (también puede ir aquí si lo prefieres) */}
          <link rel="icon" type="image/png" href="/css/location.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
