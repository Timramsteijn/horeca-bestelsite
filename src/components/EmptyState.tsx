export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[10px] border border-border-light bg-white px-4 py-8 text-center text-[14px] text-text-muted">
      {message}
    </div>
  );
}
