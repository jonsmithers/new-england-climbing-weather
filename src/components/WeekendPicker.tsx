import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { type Weekend, formatRange, weekendAt } from '../lib/weekend';
import './WeekendPicker.css';

type Props = {
  offset: number;
  onOffsetChange: (offset: number) => void;
};

export function WeekendPicker({ offset, onOffsetChange }: Props) {
  const options: { offset: number; label: string; weekend: Weekend }[] = [
    { offset: 0, label: 'This weekend', weekend: weekendAt(0) },
    { offset: 1, label: 'Next weekend', weekend: weekendAt(1) },
  ];

  return (
    <ToggleGroup
      className="weekend-picker"
      value={[String(offset)]}
      onValueChange={(values) => {
        if (values.length === 0) return;
        const next = Number(values[values.length - 1]);
        if (!Number.isNaN(next)) onOffsetChange(next);
      }}
      aria-label="Weekend"
    >
      {options.map((opt) => (
        <Toggle
          key={opt.offset}
          value={String(opt.offset)}
          className="weekend-option"
        >
          <span className="weekend-label">{opt.label}</span>
          <span className="weekend-range">{formatRange(opt.weekend)}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
