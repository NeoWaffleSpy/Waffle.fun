import { useCourierStore } from '../store';

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m)}:${String(r).padStart(2, '0')}`;
};

interface Props {
  onPause: () => void;
  onMap: () => void;
  onMute: () => void;
}

export function Hud({ onPause, onMap, onMute }: Props) {
  const hud = useCourierStore((s) => s.hud);
  const muted = useCourierStore((s) => s.muted);
  const mapView = useCourierStore((s) => s.mapView);

  return (
    <div className="gc-hud">
      <div className="gc-hud__top">
        {hud && (
          <div className="gc-target" aria-live="polite">
            <span className="gc-target__leg">
              Delivery {Math.min(hud.leg + 1, hud.legs)}/{hud.legs}
            </span>
            <span className="gc-target__name">
              → {hud.targetName}
              {hud.targetKind === 'moon' && <small> (moon)</small>}
            </span>
            <span className="gc-target__stats">
              {hud.inZone ? 'in zone' : `${hud.dist.toFixed(0)} u`} ·{' '}
              <span className={hud.dockSpeedOk ? 'ok' : 'warn'}>
                {hud.relSpeed.toFixed(1)} u/s rel
              </span>
            </span>
            {hud.inZone && (
              <span className="gc-dock" aria-label="Docking progress">
                <span style={{ width: `${String(Math.round(hud.dockProgress * 100))}%` }} />
              </span>
            )}
          </div>
        )}
        <div className="gc-hud__right">
          {hud && (
            <span className="gc-clock">
              {fmtTime(hud.seconds)} · <strong>{hud.score}</strong>
            </span>
          )}
          <div className="gc-icons">
            <button
              type="button"
              onClick={onMap}
              aria-pressed={mapView}
              aria-label="Toggle map view (M)"
            >
              Map
            </button>
            <button
              type="button"
              onClick={onMute}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? 'Sound off' : 'Sound'}
            </button>
            <button type="button" onClick={onPause} aria-label="Pause (P)">
              Pause
            </button>
          </div>
        </div>
      </div>

      {hud && (
        <div className="gc-fuel" aria-label={`Fuel ${String(Math.round(hud.fuel * 100))}%`}>
          <span>Fuel</span>
          <span className="gc-fuel__bar">
            <span
              className={hud.fuel < 0.2 ? 'low' : undefined}
              style={{ width: `${String(Math.round(hud.fuel * 100))}%` }}
            />
          </span>
          <span className="gc-frame" title="The forecast line is drawn relative to this body">
            path vs {hud.frameName}
          </span>
        </div>
      )}
    </div>
  );
}
