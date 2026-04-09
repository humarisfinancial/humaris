import { LoginForm } from '@/components/auth/login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — Humaris',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Humaris
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Financial Intelligence Platform
          </p>
        </div>
        <LoginForm searchParams={searchParams} />
      </div>
    </div>
  )
}
