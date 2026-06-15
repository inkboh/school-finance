import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ThumbsUp, ThumbsDown, Minus, RotateCcw } from 'lucide-react'
import { votesApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import type { VoteType, DirectorVote } from '../../types'

const VOTE_STYLES: Record<VoteType, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  FOR:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <ThumbsUp size={13} /> },
  AGAINST: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: <ThumbsDown size={13} /> },
  ABSTAIN: { bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   icon: <Minus size={13} /> },
}

interface VotePanelProps {
  entityType: 'Project' | 'Obligation' | 'Document'
  entityId: string
}

export default function VotePanel({ entityType, entityId }: VotePanelProps) {
  const { user } = useAuthStore()
  const isDirector = user?.role === 'DIRECTOR'
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['votes', entityType, entityId],
    queryFn: () => votesApi.getVotes(entityType, entityId),
    enabled: !!entityId,
  })

  const votes: DirectorVote[] = data?.success ? data.data : []
  const myVote = votes.find((v) => v.voterId === user?.id)

  const forVotes     = votes.filter((v) => v.vote === 'FOR')
  const againstVotes = votes.filter((v) => v.vote === 'AGAINST')
  const abstainVotes = votes.filter((v) => v.vote === 'ABSTAIN')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['votes', entityType, entityId] })

  const castMutation = useMutation({
    mutationFn: (vote: VoteType) => votesApi.castVote(entityType, entityId, vote),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => votesApi.deleteVote(entityType, entityId),
    onSuccess: invalidate,
  })

  return (
    <div className="card-md space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Director Votes</h2>

      {/* Tally */}
      <div className="grid grid-cols-3 gap-2">
        {([['FOR', forVotes], ['AGAINST', againstVotes], ['ABSTAIN', abstainVotes]] as [VoteType, DirectorVote[]][]).map(([type, list]) => {
          const s = VOTE_STYLES[type]
          return (
            <div key={type} className={`text-center rounded-xl border px-3 py-2.5 ${s.bg} ${s.border}`}>
              <p className={`text-xl font-bold ${s.text}`}>{list.length}</p>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mt-0.5 ${s.text}`}>{type}</p>
            </div>
          )
        })}
      </div>

      {/* Vote action — DIRECTOR only */}
      {isDirector && (
        <div>
          {myVote ? (
            <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${VOTE_STYLES[myVote.vote].bg} ${VOTE_STYLES[myVote.vote].border}`}>
              <div className="flex items-center gap-2">
                <span className={VOTE_STYLES[myVote.vote].text}>{VOTE_STYLES[myVote.vote].icon}</span>
                <span className={`text-sm font-semibold ${VOTE_STYLES[myVote.vote].text}`}>You voted {myVote.vote}</span>
              </div>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                title="Retract vote"
              >
                <RotateCcw size={11} /> Retract
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {(['FOR', 'AGAINST', 'ABSTAIN'] as VoteType[]).map((v) => {
                const s = VOTE_STYLES[v]
                return (
                  <button
                    key={v}
                    onClick={() => castMutation.mutate(v)}
                    disabled={castMutation.isPending}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg border transition-all hover:opacity-80 ${s.bg} ${s.text} ${s.border}`}
                  >
                    {s.icon} {v}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Individual voter list */}
      {votes.length > 0 ? (
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Voter Record</p>
          {votes.map((v) => {
            const s = VOTE_STYLES[v.vote]
            return (
              <div key={v.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{v.voter.name}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                  {v.vote}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-1 border-t border-slate-100 pt-3">No votes cast yet</p>
      )}
    </div>
  )
}
