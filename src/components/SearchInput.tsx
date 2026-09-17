import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount: number;
  totalCount: number;
  noun: string;
}

export function SearchInput({ value, onChange, placeholder, resultCount, totalCount, noun }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search
          size={20}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="motion w-full rounded-[8px] border border-border-light bg-white py-2.5 pl-10 pr-3 text-[14px] text-ink placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      <p className="text-[12px] text-text-muted">
        {resultCount === totalCount
          ? `${totalCount} ${noun}`
          : `${resultCount} van ${totalCount} ${noun}`}
      </p>
    </div>
  );
}
