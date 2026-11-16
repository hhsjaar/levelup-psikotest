import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageLoader } from './components/ui'
import Landing from './pages/public/Landing'
import TestEntry from './pages/public/TestEntry'
import TestRunner from './pages/public/TestRunner'
import ResultPage from './pages/public/ResultPage'

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Login = lazy(() => import('./pages/admin/Login'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Tests = lazy(() => import('./pages/admin/Tests'))
const TestEditor = lazy(() => import('./pages/admin/TestEditor'))
const Questions = lazy(() => import('./pages/admin/Questions'))
const Results = lazy(() => import('./pages/admin/Results'))
const ResultDetail = lazy(() => import('./pages/admin/ResultDetail'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))
const DimensionsPage = lazy(() => import('./pages/admin/Dimensions'))

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/t/:code" element={<TestEntry />} />
        <Route path="/tes/:token" element={<TestRunner />} />
        <Route path="/hasil/:token" element={<ResultPage />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tests" element={<Tests />} />
          <Route path="tests/:id" element={<TestEditor />} />
          <Route path="questions" element={<Questions />} />
          <Route path="results" element={<Results />} />
          <Route path="results/:id" element={<ResultDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="dimensions" element={<DimensionsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
