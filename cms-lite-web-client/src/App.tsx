import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { FluentProvider } from '@fluentui/react-components'
import { AuthProvider } from './contexts'
// import { purpleTheme } from './themes/purpleTheme'
import { teamsLightTheme } from "@fluentui/react-components";
import { ProtectedRoute } from './components'
import { SignIn, Dashboard, JsonViewer, XmlViewer, CsvViewer } from './pages'
import './App.css'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    console.log('REACT_READY');
  }, [])
  return (
    <FluentProvider theme={teamsLightTheme}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<SignIn />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/json-viewer"
              element={
                <ProtectedRoute>
                  <JsonViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/xml-viewer"
              element={
                <ProtectedRoute>
                  <XmlViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/csv-viewer"
              element={
                <ProtectedRoute>
                  <CsvViewer />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </FluentProvider>
  )
}

export default App
