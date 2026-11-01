import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import './styles.css';

const router = createRouter({ routeTree, scrollRestoration: true });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>);
