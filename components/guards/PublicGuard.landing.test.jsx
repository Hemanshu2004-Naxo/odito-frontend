import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import { PublicGuard } from './AuthGuard'
import apiService from '@/lib/apiService'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Where a signed-in customer lands when they open a public page (login, signup): with a project, on Domain Overview. The audit
// dashboard is still reachable from the sidebar. Same mocks as AuthGuard.test.jsx: the REAL AuthProvider + PublicGuard run.

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }) => children,
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}))
// One stable router object, like the real useRouter().
const mockRouter = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
vi.mock('@/lib/apiService', () => ({
  default: { isAuthenticated: vi.fn(), getProfile: vi.fn(), getToken: vi.fn(), setToken: vi.fn(), removeToken: vi.fn(), getProjects: vi.fn() },
}))
vi.mock('@/lib/socketService', () => ({ default: { connect: vi.fn(), disconnect: vi.fn() } }))
vi.mock('@/lib/queryClient', () => ({ queryClient: { clear: vi.fn() } }))

let container
let root

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(React.createElement(AuthProvider, null, React.createElement(PublicGuard, null, React.createElement('div', { 'data-testid': 'login-form' }))))
  })
}

async function flush() {
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => {
  if (root) act(() => { root.unmount() })
  if (container) container.remove()
  container = null
  root = null
})

describe('PublicGuard landing', () => {
  it('sends a signed-in customer who has a project to Domain Overview — not the audit dashboard', async () => {
    apiService.isAuthenticated.mockReturnValue(true)
    apiService.getProfile.mockResolvedValue({ success: true, data: { _id: 'u1', roleId: 5, isEmailVerified: true, hasProjects: true } })
    mount()
    await flush()
    expect(mockRouter.push).toHaveBeenCalledWith('/app/domain-overview')
    expect(mockRouter.push).not.toHaveBeenCalledWith('/app/dashboard')
  })

  it('still sends a customer with no project to onboarding', async () => {
    apiService.isAuthenticated.mockReturnValue(true)
    apiService.getProfile.mockResolvedValue({ success: true, data: { _id: 'u1', roleId: 5, isEmailVerified: true, hasProjects: false } })
    apiService.getProjects.mockResolvedValue({ success: true, data: { projects: [] } })
    mount()
    await flush()
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding')
    expect(mockRouter.push).not.toHaveBeenCalledWith('/app/domain-overview')
  })

  it('still sends a system admin to the admin area', async () => {
    apiService.isAuthenticated.mockReturnValue(true)
    apiService.getProfile.mockResolvedValue({ success: true, data: { _id: 'a1', roleId: 1, isEmailVerified: true, hasProjects: true } })
    mount()
    await flush()
    expect(mockRouter.push).toHaveBeenCalledWith('/system-admin')
    expect(mockRouter.push).not.toHaveBeenCalledWith('/app/domain-overview')
  })
})
