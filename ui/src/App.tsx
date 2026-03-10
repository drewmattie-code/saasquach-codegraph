import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import OverviewPage from '@/pages/OverviewPage'
import GraphExplorerPage from '@/pages/GraphExplorerPage'
import RepositoriesPage from '@/pages/RepositoriesPage'
import ChangesPage from '@/pages/ChangesPage'
import PipelinesPage from '@/pages/PipelinesPage'
import InsightsPage from '@/pages/InsightsPage'
import RisksPage from '@/pages/RisksPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route element={<Shell />}>
        <Route path='/' element={<OverviewPage />} />
        <Route path='/graph' element={<GraphExplorerPage />} />
        <Route path='/repositories' element={<RepositoriesPage />} />
        <Route path='/changes' element={<ChangesPage />} />
        <Route path='/pipelines' element={<PipelinesPage />} />
        <Route path='/insights' element={<InsightsPage />} />
        <Route path='/risks' element={<RisksPage />} />
        <Route path='/settings' element={<SettingsPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
}
