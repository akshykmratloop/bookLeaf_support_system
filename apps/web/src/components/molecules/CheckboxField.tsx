interface Props {
  id: string;
  name: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

/** One labelled checkbox. */
export function CheckboxField({ id, name, checked, label, onChange }: Props) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[12.5px] font-semibold">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
