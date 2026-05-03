import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/theme.css'
import './styles/app.css'

const devMode = !(window as any)?.invokeNative
const rootEl = document.getElementById('root')!
const root = ReactDOM.createRoot(rootEl)

if (window.name === '' || devMode) {
    const renderApp = () => root.render(<App />)
    if (devMode) {
        renderApp()
    } else {
        window.addEventListener('message', (event) => {
            if (event.data === 'componentsLoaded') renderApp()
        })
    }
}
