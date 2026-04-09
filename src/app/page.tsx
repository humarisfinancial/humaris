import { redirect } from 'next/navigation'

// Root redirects to dashboard — middleware handles unauthenticated redirect to /login
export default function Home() {
  redirect('/dashboard')
}
