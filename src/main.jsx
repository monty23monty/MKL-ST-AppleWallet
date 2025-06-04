// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { Amplify } from 'aws-amplify';
import { awsConfig }   from './awsConfig.js';     // v6 config from the previous step
import App         from './App.jsx';

Amplify.configure(awsConfig);                // configure once, before render
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />{/* wrapped by withAuthenticator inside */}
        </BrowserRouter>
    </React.StrictMode>,
);
