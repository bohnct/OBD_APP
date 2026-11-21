interface ChoiceProps<T extends string | number> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly names?: Partial<Record<T, string>>;
  readonly onChange: (value: T) => void;
}

/** A labelled row of segmented buttons (radio group). */
export function Choice<T extends string | number>({
  label,
  value,
  options,
  names,
  onChange,
}: ChoiceProps<T>) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="segments">
        {options.map((option) => (
          <label key={String(option)} className={option === value ? 'selected' : undefined}>
            <input
              type="radio"
              name={`${label}-${options.join('')}`}
              value={String(option)}
              checked={option === value}
              onChange={() => {
                onChange(option);
              }}
            />
            {names?.[option] ?? option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
