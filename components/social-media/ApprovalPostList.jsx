import { ApprovalPostItem } from './ApprovalPostItem'

/**
 * Scrollable list of posts for the active approval tab. `horizontal` = a row of post cards across the page (scrolls sideways when there are
 * more than fit), so the selected post's sections get the full width below it.
 */
export function ApprovalPostList({ posts, selectedPostId, onSelectPost, emptyTitle = 'Nothing here right now', emptyMessage = 'Posts will show up here as they move through the workflow.', horizontal = false }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    )
  }

  if (horizontal) {
    return (
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2" data-testid="approval-post-strip" role="list" aria-label="Posts">
        {posts.map((post) => (
          <div key={post.id} role="listitem" className="w-[280px] shrink-0 overflow-hidden rounded-xl border border-slate-100">
            <ApprovalPostItem post={post} selected={post.id === selectedPostId} onSelect={onSelectPost} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {posts.map((post) => (
        <ApprovalPostItem key={post.id} post={post} selected={post.id === selectedPostId} onSelect={onSelectPost} />
      ))}
    </div>
  )
}

export default ApprovalPostList
