'use client'

import { Download, FileText, Table, FileSpreadsheet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadStatement, type StatementPeriod } from '@/hooks/use-statements'
import type { StatementType } from '@/types'

interface ExportButtonProps {
  type: StatementType
  period: StatementPeriod
  disabled?: boolean
}

export function ExportButton({ type, period, disabled }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'pdf')}>
          <FileText className="w-4 h-4 mr-2 text-red-500" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'xlsx')}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadStatement(type, period, 'csv')}>
          <Table className="w-4 h-4 mr-2 text-blue-500" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
