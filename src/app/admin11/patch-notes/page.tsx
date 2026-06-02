import Link from 'next/link'
import { ArrowLeft, CalendarDays, Sparkles, Tag } from 'lucide-react'
import { patchNotes } from '@/data/patchNotes'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    dateStyle: 'medium',
  })
}

function getTagClass(tag: string) {
  const key = tag.toLowerCase()
  if (key.includes('bug')) return 'bg-rose-500/10 text-rose-300 border-rose-500/25'
  if (key.includes('feature')) return 'bg-primary/10 text-primary-light border-primary/25'
  if (key.includes('security')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
  if (key.includes('ui') || key.includes('ux')) return 'bg-sky-500/10 text-sky-300 border-sky-500/25'
  return 'bg-surfaceLight/50 text-textSecondary border-border'
}

export default function AdminPatchNotesPage() {
  const currentVersion = patchNotes[0]?.version ?? 'v1.1'

  return (
    <div className="min-h-screen bg-[#060609] px-4 py-8 text-textPrimary">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin11" className="mb-3 inline-flex items-center gap-2 text-xs text-textMuted hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            กลับหน้าแอดมินหลัก
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black text-textPrimary">
                <Sparkles className="h-6 w-6 text-primary" />
                Patch Notes
              </h1>
              <p className="mt-1 text-sm text-textMuted">
                ประวัติการอัปเดตระบบที่บันทึกไว้ในโค้ดโดย AI
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-bold text-primary-light">
              Current Version: {currentVersion}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-border/60 bg-surface/70 p-5 shadow-xl">
          <div className="mb-6 border-b border-border/50 pb-4">
            <h2 className="font-bold">Timeline</h2>
          </div>

          <div className="space-y-6">
            {patchNotes.map((note) => (
              <article key={`${note.version}-${note.date}`} className="relative border-l border-primary/30 pl-5">
                <div className="absolute -left-2 top-1 h-4 w-4 rounded-full border-4 border-surface bg-primary" />
                <div className="rounded-2xl border border-border/50 bg-surfaceLight/20 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary-light">
                          {note.version}
                        </span>
                        {note.tags.map((tag) => (
                          <span key={tag} className={`inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-bold ${getTagClass(tag)}`}>
                            <Tag className="mr-1 h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-lg font-black text-textPrimary">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-textMuted">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(note.date)}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {note.changes.map((change) => (
                      <li key={change} className="flex gap-2 text-sm leading-relaxed text-textSecondary">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
