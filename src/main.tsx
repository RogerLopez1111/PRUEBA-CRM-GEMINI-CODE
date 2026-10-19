import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErpApiTest from './features/erp-test/ErpApiTest';
import {AppDataProvider} from './state/AppDataContext';
import './index.css';

// Opt-in isolated ERP API test screen: visit `/?erp-test` or `/erp-test`.
// Renders standalone (no auth, no AppDataProvider) so it never touches the CRM.
const isErpTest =
  new URLSearchParams(window.location.search).has('erp-test') ||
  window.location.pathname === '/erp-test';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isErpTest ? (
      <ErpApiTest />
    ) : (
      <AppDataProvider>
        <App />
      </AppDataProvider>
    )}
  </StrictMode>,
);
