import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Toast } from './components/ui/Toast'
import { AIHubPage } from './pages/AIHub'
import { AnalysisPage } from './pages/Analysis'
import { DashboardPage } from './pages/Dashboard'
import { GraphExplorerPage } from './pages/GraphExplorer'
import { RepositoriesPage } from './pages/Repositories'
import { SearchPage } from './pages/Search'
import { SettingsPage } from './pages/Settings'

function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/graph" element={<GraphExplorerPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/ai-hub" element={<AIHubPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
      <Toast />
    </>
  )
}

export default App
