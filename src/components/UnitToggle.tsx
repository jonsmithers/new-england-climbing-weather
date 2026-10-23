import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import {
  type PrecipUnit,
  type TempUnit,
  usePrecipUnit,
  useTempUnit,
} from '../lib/units';
import './UnitToggle.css';

type Option<T extends string> = { value: T; text: string; label: string };

const TEMP_OPTIONS: Option<TempUnit>[] = [
  { value: 'F', text: '°F', label: 'Fahrenheit' },
  { value: 'C', text: '°C', label: 'Celsius' },
];

const PRECIP_OPTIONS: Option<PrecipUnit>[] = [
  { value: 'in', text: 'in', label: 'Inches' },
  { value: 'mm', text: 'mm', label: 'Millimeters' },
];

export function TempUnitToggle() {
  const [unit, setUnit] = useTempUnit();
  return (
    <UnitToggle
      options={TEMP_OPTIONS}
      value={unit}
      onChange={setUnit}
      label="Temperature unit"
    />
  );
}

export function PrecipUnitToggle() {
  const [unit, setUnit] = usePrecipUnit();
  return (
    <UnitToggle
      options={PRECIP_OPTIONS}
      value={unit}
      onChange={setUnit}
      label="Precipitation unit"
    />
  );
}

// Same pill-shaped segmented control as the ThemeToggle, with text options.
function UnitToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      className="unit-toggle"
      value={[value]}
      onValueChange={(values) => {
        // Pressing the active option would deselect it; keep one always on.
        const next = values[values.length - 1] as T | undefined;
        if (next) onChange(next);
      }}
      aria-label={label}
    >
      {options.map((opt) => (
        <Toggle
          key={opt.value}
          value={opt.value}
          className="unit-option"
          aria-label={opt.label}
          title={opt.label}
        >
          {opt.text}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
