import { SignupForm } from '@/components/auth/signup-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account — Humaris',
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Humaris
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Create your account to get started
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
