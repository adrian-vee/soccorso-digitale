import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaasDashboard } from './pages/SaasDashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SaasDashboard />
    </QueryClientProvider>
  )
}
