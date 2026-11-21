import { useState } from 'react';
import { getProfile } from '../../profiles/registry';
import { gaugeLayoutFor, useSettings } from '../../state/settings';
import { Gauge } from '../gauges/Gauge';
import type { GaugeTheme } from '../theme/themes';
import { useDisplayParameter } from '../useDisplayParameter';
import { useLongPress } from '../useLongPress';
import { plotAddedMessage, useDoubleTap } from '../useDoubleTap';
import { useToast } from '../toastStore';
import { GaugeSlotEditor } from './GaugeSlotEditor';

/** The primary page: eight gauges. Hold one to change what it shows. */
export function GaugePage({ theme }: { readonly theme: GaugeTheme }) {
  const profileId = useSettings((s) => s.profileId);
  const layout = useSettings((s) => gaugeLayoutFor(s, profileId));
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div className="gauge-grid">
      {layout.map((id, slot) => (
        <GaugeSlot
          key={`${String(slot)}-${id}`}
          profileId={profileId}
          parameterId={id}
          slot={slot}
          theme={theme}
          onEdit={() => {
            setEditing(slot);
          }}
        />
      ))}
      {editing === null ? null : (
        <GaugeSlotEditor
          theme={theme}
          slot={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface SlotProps {
  readonly profileId: string;
  readonly parameterId: string;
  readonly slot: number;
  readonly theme: GaugeTheme;
  readonly onEdit: () => void;
}

function GaugeSlot({ profileId, parameterId, slot, theme, onEdit }: SlotProps) {
  const param = getProfile(profileId).parameters.find((p) => p.id === parameterId);
  const display = useDisplayParameter(param);
  const press = useLongPress(onEdit);
  const addPlot = useSettings((s) => s.addPlot);
  const showToast = useToast((s) => s.show);
  const doubleTap = useDoubleTap(() => {
    if (!param) return;
    showToast(plotAddedMessage(param.short, addPlot(profileId, param.id)));
  });
  return (
    <button
      type="button"
      className="gauge-slot"
      aria-label={`${param?.name ?? 'Empty'} gauge. Hold, or press Enter, to change it. Double-tap to plot it.`}
      {...press}
      onPointerUp={(e) => {
        press.onPointerUp();
        doubleTap.onPointerUp(e);
      }}
      onClick={(e) => {
        // Taps do nothing; only a hold (or the keyboard) opens the editor.
        if (e.detail === 0) onEdit();
      }}
      onContextMenu={(e) => {
        e.preventDefault(); // stop the browser menu on long-press / right-click
      }}
    >
      {display ? <Gauge theme={theme} variant={slot < 4 ? 'top' : 'bottom'} {...display} /> : null}
    </button>
  );
}
