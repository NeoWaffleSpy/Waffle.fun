import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  type Group,
  Line,
  LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three';
import { OrbitRing } from '../../../shared/three/worlds/OrbitRing';
import { PlanetBody } from '../../../shared/three/worlds/PlanetBody';
import { StarBody } from '../../../shared/three/worlds/StarBody';
import { Starfield } from '../../../shared/three/worlds/Starfield';
import { bodyStates, type StarSystem } from '../../../shared/worlds/system';
import type { CourierAudio } from '../audio';
import type { InputState } from '../input';
import {
  DOCK_SPEED,
  DOCK_TICKS,
  DT,
  dockRadius,
  FUEL_MAX,
  IN_THRUST,
  TICK_RATE,
} from '../sim/constants';
import { encodeReplay } from '../sim/replay';
import {
  type CourierSim,
  EV_COMPLETE,
  EV_CRASH,
  EV_DOCKED,
  EV_LOW_FUEL,
  dominantBody,
  predictPath,
  STAR,
} from '../sim/sim';
import { saveGhostIfBest } from '../ghost';
import { useCourierStore } from '../store';

/** Everything belonging to one run. Recreated on every (re)start. */
export interface Run {
  sim: CourierSim;
  ghost: CourierSim | null;
  ghostInputs: Uint8Array | null;
}

interface Props {
  system: StarSystem;
  runRef: RefObject<Run | null>;
  input: InputState;
  audio: CourierAudio;
}

const PREDICT_TICKS = 900; // 15 s look-ahead
const PREDICT_EVERY = 3;
const DEFAULT_ZOOM = 75;

interface Pose {
  x: number;
  y: number;
  angle: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function GameScene({ system, runRef, input, audio }: Props) {
  const { camera, gl } = useThree();
  const n = system.bodies.length;

  // ---- per-system scratch buffers (allocated once, mutated every frame)
  const renderPos = useMemo(() => new Float64Array(n * 2), [n]);
  const renderVel = useMemo(() => new Float64Array(n * 2), [n]);
  const scratch = useMemo(
    () => ({ pos: new Float64Array(n * 2), vel: new Float64Array(n * 2) }),
    [n],
  );
  const predicted = useMemo(
    () => new Float32Array(((PREDICT_TICKS / PREDICT_EVERY) | 0) * 2 + 4),
    [],
  );
  // One light direction per body, mutated per frame (PlanetBody reads it by reference).
  const sunDirs = useMemo(() => system.bodies.map(() => new Vector3(1, 0, 0)), [system]);

  // ---- object refs
  const bodyGroups = useRef<(Group | null)[]>([]);
  const moonRingGroups = useRef<(Group | null)[]>([]);
  const ship = useRef<Group>(null);
  const flame = useRef<Mesh>(null);
  const ghost = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const arrow = useRef<Mesh>(null);
  const stars = useRef<Group>(null);
  // Mutated per frame through the ref (never through the memoized value).
  const trajRef = useRef<Line<BufferGeometry, LineBasicMaterial>>(null);

  // ---- loop state
  const acc = useRef(0);
  const prevShip = useRef<Pose>({ x: 0, y: 0, angle: 0 });
  const prevGhost = useRef<Pose>({ x: 0, y: 0, angle: 0 });
  const menuTime = useRef(0);
  const hudTimer = useRef(0);
  const pathFrame = useRef(-2);
  const frame = useRef(0);
  const zoom = useRef(DEFAULT_ZOOM);
  const focus = useRef({ x: 0, y: 0, h: 400 });
  const lastRun = useRef<Run | null>(null);

  // ---- procedural meshes (no assets)
  const shipGeo = useMemo(() => new ConeGeometry(0.9, 2.6, 12).rotateZ(-Math.PI / 2), []);
  const flameGeo = useMemo(
    () => new ConeGeometry(0.5, 2, 10).rotateZ(Math.PI / 2).translate(-2.3, 0, 0),
    [],
  );
  const arrowGeo = useMemo(() => new ConeGeometry(0.6, 1.8, 3).rotateZ(-Math.PI / 2), []);
  const ringGeo = useMemo(() => new RingGeometry(0.94, 1, 96).rotateX(-Math.PI / 2), []);
  const trajectory = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array((predicted.length / 2) * 3), 3),
    );
    return new Line(
      g,
      new LineBasicMaterial({ color: '#7fd3ff', transparent: true, opacity: 0.75 }),
    );
  }, [predicted]);

  useEffect(
    () => () => {
      shipGeo.dispose();
      flameGeo.dispose();
      arrowGeo.dispose();
      ringGeo.dispose();
      trajectory.geometry.dispose();
      trajectory.material.dispose();
    },
    [shipGeo, flameGeo, arrowGeo, ringGeo, trajectory],
  );

  // Mouse-wheel zoom (follow camera). Map view ignores it.
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.min(
        500,
        Math.max(22, zoom.current * Math.exp(Math.sign(e.deltaY) * 0.12)),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  const finishRun = (run: Run) => {
    const { sim } = run;
    const st = useCourierStore.getState();
    const score = sim.score();
    const replay = encodeReplay(system.seed, sim.inputs);
    const isBest = score > 0 && saveGhostIfBest(system.seed, { score, replay });
    const crashed =
      sim.outcome === 'crashed'
        ? sim.crashedInto === STAR
          ? system.star.name
          : (system.bodies[sim.crashedInto]?.name ?? null)
        : null;
    st.finish({
      outcome: sim.outcome,
      score,
      legScores: [...sim.legScores],
      fuelBonus: sim.fuelBonus(),
      seconds: sim.tick / TICK_RATE,
      crashedInto: crashed,
      replay,
      ticks: sim.tick,
      isBest,
    });
  };

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.25);
    const st = useCourierStore.getState();
    const run = runRef.current;
    frame.current++;

    // New run → reset interpolation state.
    if (run !== lastRun.current) {
      lastRun.current = run;
      acc.current = 0;
      if (run) {
        prevShip.current = { ...run.sim.ship };
        if (run.ghost) prevGhost.current = { ...run.ghost.ship };
      }
    }

    // ---- fixed-step simulation
    let alpha = 1;
    const playing = st.phase === 'playing' && run !== null;
    if (playing && !st.paused && run.sim.isFlying()) {
      acc.current += delta;
      let steps = 0;
      while (acc.current >= DT && steps < 8 && run.sim.isFlying()) {
        prevShip.current = { ...run.sim.ship };
        const ev = run.sim.step(input.byte);
        if (ev & EV_COMPLETE) audio.complete();
        else if (ev & EV_DOCKED) audio.docked();
        if (ev & EV_CRASH) audio.crash();
        if (ev & EV_LOW_FUEL) audio.lowFuel();
        const g = run.ghost;
        if (g && run.ghostInputs && g.outcome === 'flying' && g.tick < run.ghostInputs.length) {
          prevGhost.current = { ...g.ship };
          g.step(run.ghostInputs[g.tick]!);
        }
        acc.current -= DT;
        steps++;
      }
      if (steps === 8) acc.current = 0; // tab was hidden: don't spiral
      alpha = Math.min(1, acc.current / DT);
      audio.setThrust((input.byte & IN_THRUST) !== 0 && run.sim.fuel > 0 && run.sim.isFlying());
      if (!run.sim.isFlying()) {
        audio.setThrust(false);
        finishRun(run);
      }
    } else {
      audio.setThrust(false);
    }

    // ---- body positions for rendering
    let t: number;
    if (st.phase === 'menu' || !run) {
      menuTime.current += delta;
      t = menuTime.current;
    } else {
      t = (run.sim.tick - 1 + alpha) / TICK_RATE;
    }
    bodyStates(system, Math.max(0, t), renderPos, renderVel);
    for (const b of system.bodies) {
      const x = renderPos[b.index * 2]!;
      const y = renderPos[b.index * 2 + 1]!;
      bodyGroups.current[b.index]?.position.set(x, 0, y);
      // Light comes from the star at the origin.
      sunDirs[b.index]!.set(-x, 0, -y).normalize();
      if (b.parent >= 0) {
        const px = renderPos[b.parent * 2] ?? 0;
        const py = renderPos[b.parent * 2 + 1] ?? 0;
        moonRingGroups.current[b.index]?.position.set(px, 0, py);
      }
    }

    // ---- ship + ghost
    const showShip = run !== null && st.phase !== 'menu';
    let sx = 0;
    let sy = 0;
    if (ship.current) {
      ship.current.visible = showShip && run.sim.outcome !== 'crashed';
      if (showShip) {
        const p = prevShip.current;
        const c = run.sim.ship;
        sx = lerp(p.x, c.x, alpha);
        sy = lerp(p.y, c.y, alpha);
        ship.current.position.set(sx, 0, sy);
        ship.current.rotation.y = -lerp(p.angle, c.angle, alpha);
      }
    }
    if (flame.current) {
      const on = playing && (input.byte & IN_THRUST) !== 0 && run.sim.fuel > 0 && !st.paused;
      flame.current.visible = on;
      if (on) flame.current.scale.setScalar(0.8 + Math.random() * 0.4);
    }
    if (ghost.current) {
      const g = run?.ghost;
      const visible = showShip && !!g && g.outcome === 'flying';
      ghost.current.visible = visible;
      if (visible) {
        const p = prevGhost.current;
        ghost.current.position.set(lerp(p.x, g.ship.x, alpha), 0, lerp(p.y, g.ship.y, alpha));
        ghost.current.rotation.y = -lerp(p.angle, g.ship.angle, alpha);
      }
    }

    // ---- target marker + direction arrow
    const target = run && st.phase !== 'menu' ? system.bodies[run.sim.target] : undefined;
    const rel = run ? run.sim.relativeToTarget() : null;
    if (marker.current) {
      marker.current.visible = !!target;
      if (target && rel) {
        const tx = renderPos[target.index * 2]!;
        const ty = renderPos[target.index * 2 + 1]!;
        marker.current.position.set(tx, 0.1, ty);
        marker.current.scale.setScalar(dockRadius(target.radius));
        const inZone = rel.dist < rel.dockRadius;
        const mat = marker.current.material as MeshBasicMaterial;
        mat.color.set(inZone ? (rel.speed < DOCK_SPEED ? '#6dff9a' : '#ffb347') : '#ffd36b');
        mat.opacity = 0.55 + 0.3 * Math.sin(state.clock.elapsedTime * 4);
      }
    }
    if (arrow.current) {
      const visible = !!target && !!rel && showShip && rel.dist > rel.dockRadius * 1.3;
      arrow.current.visible = visible;
      if (visible) {
        const dx = renderPos[target.index * 2]! - sx;
        const dy = renderPos[target.index * 2 + 1]! - sy;
        const a = Math.atan2(dy, dx);
        arrow.current.position.set(sx + Math.cos(a) * 5.5, 0, sy + Math.sin(a) * 5.5);
        arrow.current.rotation.y = -a;
      }
    }

    // ---- trajectory forecast (every other frame is plenty)
    const line = trajRef.current;
    if (line) {
      const showPath = playing && run.sim.isFlying();
      line.visible = showPath;
      if (showPath && frame.current % 2 === 0) {
        // Draw the path in the frame of whatever we're orbiting.
        pathFrame.current = dominantBody(run.sim);
        const { count, hit } = predictPath(
          run.sim,
          PREDICT_TICKS,
          PREDICT_EVERY,
          predicted,
          scratch,
          pathFrame.current,
        );
        const attr = line.geometry.getAttribute('position') as BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          arr[i * 3] = predicted[i * 2]!;
          arr[i * 3 + 1] = 0.05;
          arr[i * 3 + 2] = predicted[i * 2 + 1]!;
        }
        attr.needsUpdate = true;
        line.geometry.setDrawRange(0, count);
        line.geometry.computeBoundingSphere();
        line.material.color.set(hit !== -2 ? '#ff6b6b' : '#7fd3ff');
      }
    }

    // ---- camera: follow the ship, or frame the whole system
    const aspect = state.size.width / Math.max(1, state.size.height);
    const fitH = (system.boundary / (Math.tan((25 * Math.PI) / 180) * Math.min(1, aspect))) * 0.8;
    const overview = st.phase === 'menu' || st.mapView || !run;
    // Portrait screens see less width at the same height: back off to compensate.
    const followH = zoom.current / Math.max(0.55, Math.min(1, aspect));
    const goal = overview ? { x: 0, y: 0, h: fitH } : { x: sx, y: sy, h: followH };
    const k = 1 - Math.exp(-delta * (overview ? 3 : 8));
    const f = focus.current;
    f.x = lerp(f.x, goal.x, k);
    f.y = lerp(f.y, goal.y, k);
    f.h = lerp(f.h, goal.h, 1 - Math.exp(-delta * 4));
    camera.position.set(f.x, f.h, f.y + f.h * 0.45);
    camera.lookAt(f.x, 0, f.y);
    stars.current?.position.copy(camera.position);

    // ---- throttled HUD snapshot (10 Hz) so React re-renders stay rare
    hudTimer.current += delta;
    if (playing && hudTimer.current > 0.1 && target && rel) {
      hudTimer.current = 0;
      st.setHud({
        fuel: run.sim.fuel / FUEL_MAX,
        leg: run.sim.leg,
        legs: run.sim.plan.legs.length,
        targetName: target.name,
        targetKind: target.kind,
        dist: rel.dist,
        relSpeed: rel.speed,
        dockSpeedOk: rel.speed < DOCK_SPEED,
        dockProgress: run.sim.dockTicks / DOCK_TICKS,
        inZone: rel.dist < rel.dockRadius,
        seconds: run.sim.tick / TICK_RATE,
        score: run.sim.score(),
        frameName: system.bodies[pathFrame.current]?.name ?? system.star.name,
      });
    }
  });

  return (
    <>
      <color attach="background" args={['#03040a']} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={2.4} decay={0} />

      <group ref={stars}>
        <Starfield seed={system.seed} count={2500} radius={1800} size={5} />
      </group>

      <group scale={system.star.radius}>
        <StarBody color={system.star.color} />
      </group>

      {system.bodies
        .filter((b) => b.parent === -1)
        .map((b) => (
          <OrbitRing
            key={`o${String(b.index)}`}
            radius={b.orbitRadius}
            opacity={0.1}
            segments={192}
          />
        ))}

      {system.bodies.map((b) =>
        b.parent >= 0 ? (
          <group
            key={`m${String(b.index)}`}
            ref={(el) => {
              moonRingGroups.current[b.index] = el;
            }}
          >
            <OrbitRing radius={b.orbitRadius} opacity={0.08} />
          </group>
        ) : null,
      )}

      {system.bodies.map((b) => (
        <group
          key={b.index}
          ref={(el) => {
            bodyGroups.current[b.index] = el;
          }}
        >
          <group scale={b.radius}>
            <PlanetBody
              world={b.world}
              detail={b.kind === 'planet' ? 40 : 20}
              quality="low"
              sunDirection={sunDirs[b.index]}
              spin={0.05}
            />
          </group>
        </group>
      ))}

      <mesh ref={marker} geometry={ringGeo} visible={false}>
        <meshBasicMaterial
          color="#ffd36b"
          transparent
          opacity={0.7}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <primitive object={trajectory} ref={trajRef} />

      <mesh ref={arrow} geometry={arrowGeo} visible={false}>
        <meshBasicMaterial color="#ffd36b" transparent opacity={0.85} />
      </mesh>

      <group ref={ghost} visible={false}>
        <mesh geometry={shipGeo}>
          <meshBasicMaterial color="#9fd8ff" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>

      <group ref={ship} visible={false}>
        <mesh geometry={shipGeo}>
          <meshStandardMaterial
            color="#eef2fa"
            metalness={0.3}
            roughness={0.45}
            emissive="#1a2238"
          />
        </mesh>
        <mesh ref={flame} geometry={flameGeo} visible={false}>
          <meshBasicMaterial
            color="#ffae42"
            blending={AdditiveBlending}
            transparent
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
