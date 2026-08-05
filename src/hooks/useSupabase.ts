export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }

  // Handle text responses (ZKTeco)
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('text/plain')) {
    return (await res.text()) as unknown as T
  }

  return res.json()
}

export function useApi() {
  return {
    // ─── Children ────────────────────────────────
    children: {
      getAll: (q?: string) => request(`/children${q ? `?q=${q}` : ''}`),
      getById: (id: string) => request(`/children/${id}`),
      create: (data: any) => request('/children', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/children/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/children/${id}`, { method: 'DELETE' }),
    },

    // ─── Parents ─────────────────────────────────
    parents: {
      getAll: (childId?: string) => request(`/parents${childId ? `?child_id=${childId}` : ''}`),
      getById: (id: string) => request(`/parents/${id}`),
      create: (data: any) => request('/parents', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/parents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/parents/${id}`, { method: 'DELETE' }),
      linkChild: (parentId: string, childId: string) =>
        request(`/parents/${parentId}/children/${childId}`, { method: 'POST' }),
      unlinkChild: (parentId: string, childId: string) =>
        request(`/parents/${parentId}/children/${childId}`, { method: 'DELETE' }),
    },

    // ─── Subscriptions ───────────────────────────
    subscriptions: {
      getAll: (params?: { child_id?: string; status?: string }) => {
        const q = new URLSearchParams(params || {}).toString()
        return request(`/subscriptions${q ? `?${q}` : ''}`)
      },
      getById: (id: string) => request(`/subscriptions/${id}`),
      create: (data: any) => request('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/subscriptions/${id}`, { method: 'DELETE' }),
      confirm: (id: string, confirmedBy: string) =>
        request(`/subscriptions/${id}/confirm`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy }) }),
      unconfirm: (id: string) => request(`/subscriptions/${id}/unconfirm`, { method: 'POST' }),
      reject: (id: string) => request(`/subscriptions/${id}/reject`, { method: 'POST' }),
      pay: (id: string, data: any) => request(`/subscriptions/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
      // New: get activities/groups/courses for a subscription
      getActivities: (id: string) => request(`/subscriptions/${id}/activities`),
      getGroups: (id: string) => request(`/subscriptions/${id}/groups`),
      getCourses: (id: string) => request(`/subscriptions/${id}/courses`),
    },

    // ─── Exercises ───────────────────────────────
    exercises: {
      getAll: (params?: { day?: string; coach_id?: string }) => {
        const q = new URLSearchParams(params || {}).toString()
        return request(`/exercises${q ? `?${q}` : ''}`)
      },
      getById: (id: string) => request(`/exercises/${id}`),
      create: (data: any) => request('/exercises', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/exercises/${id}`, { method: 'DELETE' }),
    },

    // ─── Trainers ────────────────────────────────
    trainers: {
      getAll: () => request('/trainers'),
      getById: (id: string) => request(`/trainers/${id}`),
      create: (data: any) => request('/trainers', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/trainers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/trainers/${id}`, { method: 'DELETE' }),
    },

    // ─── Attendance ──────────────────────────────
    attendance: {
      getAbsences: () => request('/attendance/absences'),
      createAbsence: (data: any) => request('/attendance/absences', { method: 'POST', body: JSON.stringify(data) }),
      justifyAbsence: (id: string, justification: string) =>
        request(`/attendance/absences/${id}/justify`, { method: 'PUT', body: JSON.stringify({ justification }) }),
      getLogs: (limit = 50) => request(`/attendance/logs?limit=${limit}`),
      createLog: (data: any) => request('/attendance/logs', { method: 'POST', body: JSON.stringify(data) }),
      getSchedules: (childId: string) => request(`/attendance/schedules/${childId}`),
      createSchedule: (data: any) => request('/attendance/schedules', { method: 'POST', body: JSON.stringify(data) }),
      getExerciseChildren: (exerciseId: string) => request(`/attendance/exercises/${exerciseId}/children`),
      checkAttendance: (exerciseId: string, date: string) => request(`/attendance/exercises/${exerciseId}/check/${date}`),
      markAttendance: (data: { exercise_id: string; date: string; absences: { child_id: string; type: string }[] }) =>
        request('/attendance/mark', { method: 'POST', body: JSON.stringify(data) }),
    },

    // ─── Checks ──────────────────────────────────
    checks: {
      getAll: () => request('/checks'),
      getById: (id: string) => request(`/checks/${id}`),
      create: (data: any) => request('/checks', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/checks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/checks/${id}`, { method: 'DELETE' }),
      useCheck: (id: string, amountUsed: number, paymentId?: string) =>
        request(`/checks/${id}/use`, { method: 'PUT', body: JSON.stringify({ amount_used: amountUsed, payment_id: paymentId }) }),
    },

    // ─── Payments ────────────────────────────────
    payments: {
      getAll: () => request('/payments'),
      create: (data: any) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
      getChecks: () => request('/payments/checks'),
      createCheck: (data: any) => request('/payments/checks', { method: 'POST', body: JSON.stringify(data) }),
      useCheck: (id: string, paymentId: string) =>
        request(`/payments/checks/${id}/use`, { method: 'PUT', body: JSON.stringify({ payment_id: paymentId }) }),
    },

    // ─── Auth ────────────────────────────────────
    auth: {
      login: (email: string, password: string) =>
        request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    },

    // ─── Users (accounts) ────────────────────────
    users: {
      getAll: () => request('/users'),
      getById: (id: string) => request(`/users/${id}`),
      create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
    },

    requests: {
      getAll: () => request('/requests'),
      create: (data: any) => request('/requests', { method: 'POST', body: JSON.stringify(data) }),
      approve: (id: string) => request(`/requests/${id}/approve`, { method: 'POST' }),
      reject: (id: string) => request(`/requests/${id}/reject`, { method: 'POST' }),
    },

    // ─── Prices ──────────────────────────────────
    prices: {
      getAll: () => request('/prices'),
      update: (id: string, amount: number) =>
        request(`/prices/${id}`, { method: 'PUT', body: JSON.stringify({ amount }) }),
      getDiscounts: () => request('/prices/discounts'),
      createDiscount: (data: any) => request('/prices/discounts', { method: 'POST', body: JSON.stringify(data) }),
      toggleDiscount: (id: string, active: boolean) =>
        request(`/prices/discounts/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ active }) }),
    },

    // ─── Upload ──────────────────────────────────
    upload: {
      file: async (formData: FormData) => {
        const res = await fetch(`${FUNCTIONS_URL}/upload`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(err.error || 'Upload failed')
        }
        return res.json()
      },
    },

    // ─── Groups ──────────────────────────────────
    groups: {
      getAll: () => request('/groups'),
      getById: (id: string) => request(`/groups/${id}`),
      create: (data: any) => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request(`/groups/${id}`, { method: 'DELETE' }),
    },

    // ─── ZKTeco ──────────────────────────────────
    zkteco: {
      getDevices: () => request('/zkteco/devices'),
      updateDeviceStatus: (id: string, status: string) =>
        request(`/zkteco/devices/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
      getLogs: (params?: { limit?: number; offset?: number; child_id?: string; status?: string; from?: string; to?: string }) => {
        const q = new URLSearchParams()
        if (params?.limit) q.set('limit', String(params.limit))
        if (params?.offset) q.set('offset', String(params.offset))
        if (params?.child_id) q.set('child_id', params.child_id)
        if (params?.status) q.set('status', params.status)
        if (params?.from) q.set('from', params.from)
        if (params?.to) q.set('to', params.to)
        return request(`/zkteco/logs${q.toString() ? `?${q}` : ''}`)
      },
      getAccessLogs: (params?: { limit?: number; offset?: number; child_id?: string }) => {
        const q = new URLSearchParams()
        if (params?.limit) q.set('limit', String(params.limit))
        if (params?.offset) q.set('offset', String(params.offset))
        if (params?.child_id) q.set('child_id', params.child_id)
        return request(`/zkteco/access-logs${q.toString() ? `?${q}` : ''}`)
      },
      getStats: () => request('/zkteco/logs/stats'),
      getDeviceCommands: (deviceId: string) => request(`/zkteco/devices/${deviceId}/commands`),
      queueCommand: (deviceId: string, command: string, params?: Record<string, unknown>) =>
        request(`/zkteco/devices/${deviceId}/commands`, { method: 'POST', body: JSON.stringify({ command, params }) }),
    },
  }
}