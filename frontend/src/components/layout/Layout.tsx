import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useProfileStore } from '../../stores/profile'

export default function Layout() {
  const fetchProfiles = useProfileStore(s => s.fetchProfiles)

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
