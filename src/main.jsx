// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';

const cognitoAuthConfig = {
  authority: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_LBU472pes',
  client_id: '446f6ubc33tbcjonhb158ua9p7',
  redirect_uri: 'http://localhost:5173',
  response_type: 'code',
  scope: 'email openid phone',
};

const root = ReactDOM.createRoot(document.getElementById('root'));

// wrap the application with AuthProvider
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
