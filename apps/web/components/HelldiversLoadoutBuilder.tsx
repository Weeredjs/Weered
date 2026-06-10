"use client";

import React, { useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

const PRIMARIES = [
  "AR-23 Liberator", "AR-23P Liberator Penetrator", "AR-23C Liberator Concussive",
  "R-63 Diligence", "R-63CS Diligence Counter Sniper",
  "SG-225 Breaker", "SG-225IE Breaker Incendiary", "SG-225SP Breaker Spray&Pray",
  "SG-8 Punisher", "SG-8P Punisher Plasma", "SG-8S Slugger",
  "SMG-37 Defender", "SMG-72 Pummeler", "MP-98 Knight",
  "ARC-12 Blitzer",
  "SG-451 Cookout",
  "SCAR (BR-14 Adjudicator)", "JAR-5 Dominator",
  "PLAS-1 Scorcher", "PLAS-101 Purifier",
  "LAS-5 Scythe", "LAS-16 Sickle",
  "CB-9 Exploding Crossbow",
  "R-2 Amendment",
  "StA-52 Assault Rifle", "StA-X3 W.A.S.P. Launcher",
  "Tenderizer (AR-61)",
  "Eruptor (R-36)",
];

const SECONDARIES = [
  "P-2 Peacemaker", "P-19 Redeemer", "P-4 Senator", "GP-31 Grenade Pistol",
  "P-113 Verdict", "Crisper (LAS-7)", "Talon (LAS-58)", "Dagger (LAS-7)",
  "Loyalist (LAS-58)", "Stim Pistol (P-11)", "Bushwhacker (CQC-19)",
  "PLAS-15 Loyalist", "P-72 Crisper",
];

const THROWABLES = [
  "G-6 Frag", "G-12 High Explosive", "G-10 Incendiary", "G-16 Impact",
  "G-3 Smoke", "G-23 Stun", "G-13 Incendiary Impact", "G-123 Thermite",
  "Anti-Personnel Minefield (G-50)", "G-4 Gas",
];

const ARMORS_LIGHT = [
  "B-01 Tactical (Light)", "SC-30 Trailblazer Scout (Light)", "CM-09 Bonesnapper (Light)",
  "RS-37 Legionnaire (Light)", "EX-00 Prototype 16 (Light)", "SA-25 Steel Trooper (Light)",
];
const ARMORS_MEDIUM = [
  "B-08 Light Gunner (Medium)", "FS-23 Battle Master (Medium)", "DP-11 Champion of the People (Medium)",
  "PH-9 Predator (Medium)", "TR-117 Alpha Commander (Medium)", "CE-27 Ground Breaker (Medium)",
];
const ARMORS_HEAVY = [
  "B-27 Fortified Commando (Heavy)", "FS-37 Ravager (Heavy)", "FS-05 Marksman (Heavy)",
  "CE-67 Titan (Heavy)", "TR-9 Cavalier of Democracy (Heavy)", "CW-22 Kodiak (Heavy)",
];
const ALL_ARMORS = [...ARMORS_LIGHT, ...ARMORS_MEDIUM, ...ARMORS_HEAVY];

const HELMETS = [
  "B-01 Tactical Helmet", "SC-30 Trailblazer Helmet", "FS-23 Battle Master Helmet",
  "PH-9 Predator Helmet", "CE-27 Ground Breaker Helmet", "TR-117 Alpha Commander Helmet",
  "CE-67 Titan Helmet", "CW-22 Kodiak Helmet", "B-27 Fortified Helmet",
  "EX-00 Prototype Helmet", "Hero of the Federation Helmet",
];

const STRATAGEMS_SUPPLY = [
  "Reinforce", "SOS Beacon", "Resupply", "Eagle Rearm", "Hellbomb", "SSSD Delivery", "Seismic Probe",
];
const STRATAGEMS_OFFENSIVE = [
  "Eagle Strafing Run", "Eagle Airstrike", "Eagle Cluster Bomb", "Eagle Napalm Airstrike",
  "Eagle Smoke Strike", "Eagle 110mm Rocket Pods", "Eagle 500kg Bomb",
  "Orbital Gatling Barrage", "Orbital Airburst Strike", "Orbital 120mm HE Barrage",
  "Orbital 380mm HE Barrage", "Orbital Walking Barrage", "Orbital Laser",
  "Orbital Railcannon Strike", "Orbital Precision Strike", "Orbital Gas Strike",
  "Orbital EMS Strike", "Orbital Smoke Strike",
];
const STRATAGEMS_DEFENSIVE = [
  "Anti-Personnel Minefield", "Incendiary Mines", "Static Field Conductors",
  "HMG Emplacement", "Shield Generator Relay", "Tesla Tower",
  "A/MG-43 Machine Gun Sentry", "A/G-16 Gatling Sentry", "A/M-12 Mortar Sentry",
  "A/AC-8 Autocannon Sentry", "A/MLS-4X Rocket Sentry", "A/M-23 EMS Mortar Sentry",
];
const STRATAGEMS_WEAPONS = [
  "MG-43 Machine Gun", "M-105 Stalwart", "MG-206 Heavy Machine Gun",
  "FLAM-40 Flamethrower",
  "AC-8 Autocannon", "RS-422 Railgun", "GR-8 Recoilless Rifle",
  "EAT-17 Expendable Anti-Tank", "MLS-4X Commando", "FAF-14 Spear",
  "GL-21 Grenade Launcher", "ARC-3 Arc Thrower", "LAS-99 Quasar Cannon",
  "LAS-98 Laser Cannon", "RL-77 Airburst Rocket Launcher",
  "StA-X3 W.A.S.P. Launcher",
];
const STRATAGEMS_BACKPACK = [
  "B-1 Supply Pack", "LIFT-850 Jump Pack", "AX/LAS-5 Guard Dog Rover",
  "AX/AR-23 Guard Dog", "SH-20 Ballistic Shield Backpack",
  "SH-32 Shield Generator Pack", "B-100 Portable Hellbomb",
];
const STRATAGEMS_VEHICLES = [
  "EXO-45 Patriot Exosuit", "EXO-49 Emancipator Exosuit",
  "M-102 Fast Recon Vehicle",
];

const ALL_STRATAGEMS = [
  ...STRATAGEMS_SUPPLY,
  ...STRATAGEMS_OFFENSIVE,
  ...STRATAGEMS_DEFENSIVE,
  ...STRATAGEMS_WEAPONS,
  ...STRATAGEMS_BACKPACK,
  ...STRATAGEMS_VEHICLES,
];

const FACTIONS = [
  { id: "ANY",         label: "Any Front",   color: "#FFD700" },
  { id: "TERMINIDS",   label: "Terminids",   color: "#f58220" },
  { id: "AUTOMATONS",  label: "Automatons",  color: "#b91c1c" },
  { id: "ILLUMINATE",  label: "Illuminate",  color: "#a855f7" },
];

const ROLES = [
  "all-rounder", "anti-tank", "support", "crowd-control",
  "stealth", "defense", "demolitions", "sniper",
];

const DIFFICULTIES = ["1-Trivial", "2-Easy", "3-Medium", "4-Challenging", "5-Hard", "6-Extreme", "7-Suicide", "8-Impossible", "9-Helldive", "10-Super Helldive"];

type Props = {
  onSaved?: (slug: string) => void;
  onCancel?: () => void;
};

export default function HelldiversLoadoutBuilder({ onSaved, onCancel }: Props) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [faction, setFaction]         = useState("ANY");
  const [role, setRole]               = useState("");
  const [difficulty, setDifficulty]   = useState("");
  const [primary, setPrimary]         = useState(PRIMARIES[0]);
  const [secondary, setSecondary]     = useState(SECONDARIES[0]);
  const [throwable, setThrowable]     = useState(THROWABLES[0]);
  const [armor, setArmor]             = useState(ARMORS_MEDIUM[0]);
  const [helmet, setHelmet]           = useState("");
  const [s1, setS1] = useState(STRATAGEMS_WEAPONS[0]);
  const [s2, setS2] = useState(STRATAGEMS_OFFENSIVE[1]);
  const [s3, setS3] = useState(STRATAGEMS_DEFENSIVE[7]);
  const [s4, setS4] = useState(STRATAGEMS_SUPPLY[2]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const factionMeta = useMemo(() => FACTIONS.find(f => f.id === faction) || FACTIONS[0], [faction]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Loadout needs a name, Helldiver."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/helldivers/loadouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          faction, role: role || null, difficulty: difficulty || null,
          primary, secondary, throwable, armor,
          helmet: helmet || null,
          stratagem1: s1, stratagem2: s2, stratagem3: s3, stratagem4: s4,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || "Failed to save");
        setSaving(false);
        return;
      }
      onSaved?.(j.loadout.slug);
    } catch (e: any) {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16, padding: 16, background: "#0a0a0a", color: "#fff" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={stampHeader(factionMeta.color)}>SUPER EARTH // FIELD MANUAL // LOADOUT REGISTRY</div>

        <Field label="Operation Codename">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="e.g. Hot Rotor Tank" style={inputStyle} />
        </Field>

        <Field label="Briefing (optional)">
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="One paragraph the squad should read before extraction." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        <Field label="Front">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FACTIONS.map(f => (
              <button
                key={f.id}
                onClick={() => setFaction(f.id)}
                style={{
                  padding: "6px 12px", borderRadius: 4, border: `1px solid ${f.color}`,
                  background: faction === f.id ? f.color : "transparent",
                  color: faction === f.id ? "#000" : f.color,
                  fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >{f.label}</button>
            ))}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
              <option value="">— any —</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="">— any —</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        <div style={sectionHeader(factionMeta.color)}>WEAPONS</div>

        <Field label="Primary">
          <select value={primary} onChange={e => setPrimary(e.target.value)} style={inputStyle}>
            {PRIMARIES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Secondary">
          <select value={secondary} onChange={e => setSecondary(e.target.value)} style={inputStyle}>
            {SECONDARIES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Throwable">
          <select value={throwable} onChange={e => setThrowable(e.target.value)} style={inputStyle}>
            {THROWABLES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>

        <div style={sectionHeader(factionMeta.color)}>ARMOR</div>

        <Field label="Armor Set">
          <select value={armor} onChange={e => setArmor(e.target.value)} style={inputStyle}>
            <optgroup label="Light">{ARMORS_LIGHT.map(a => <option key={a} value={a}>{a}</option>)}</optgroup>
            <optgroup label="Medium">{ARMORS_MEDIUM.map(a => <option key={a} value={a}>{a}</option>)}</optgroup>
            <optgroup label="Heavy">{ARMORS_HEAVY.map(a => <option key={a} value={a}>{a}</option>)}</optgroup>
          </select>
        </Field>
        <Field label="Helmet (optional)">
          <select value={helmet} onChange={e => setHelmet(e.target.value)} style={inputStyle}>
            <option value="">— matching —</option>
            {HELMETS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>

        <div style={sectionHeader(factionMeta.color)}>STRATAGEMS</div>

        <StratagemSelect label="Stratagem 1" value={s1} onChange={setS1} />
        <StratagemSelect label="Stratagem 2" value={s2} onChange={setS2} />
        <StratagemSelect label="Stratagem 3" value={s3} onChange={setS3} />
        <StratagemSelect label="Stratagem 4" value={s4} onChange={setS4} />

        {error && <div style={{ color: "#f87171", fontSize: 13, padding: "6px 10px", border: "1px solid #f87171", borderRadius: 4 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 18px", borderRadius: 4, border: `2px solid ${factionMeta.color}`,
              background: factionMeta.color, color: "#000", fontWeight: 800,
              letterSpacing: 1, cursor: saving ? "wait" : "pointer", textTransform: "uppercase",
              opacity: saving ? 0.6 : 1,
            }}
          >{saving ? "Filing..." : "Submit to Archive"}</button>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "10px 18px", borderRadius: 4, border: "1px solid #444",
                background: "transparent", color: "#aaa", fontWeight: 600, cursor: "pointer",
              }}
            >Cancel</button>
          )}
        </div>
      </div>

      <div style={{ position: "sticky", top: 16, alignSelf: "start" }}>
        <DossierPreview
          name={name || "[ UNCODENAMED OPERATION ]"}
          description={description}
          faction={factionMeta}
          role={role}
          difficulty={difficulty}
          primary={primary}
          secondary={secondary}
          throwable={throwable}
          armor={armor}
          helmet={helmet}
          stratagems={[s1, s2, s3, s4]}
        />
      </div>
    </div>
  );
}

function StratagemSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <optgroup label="Supply">{STRATAGEMS_SUPPLY.map(s => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Offensive">{STRATAGEMS_OFFENSIVE.map(s => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Defensive">{STRATAGEMS_DEFENSIVE.map(s => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Support Weapons">{STRATAGEMS_WEAPONS.map(s => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Backpack">{STRATAGEMS_BACKPACK.map(s => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Vehicles">{STRATAGEMS_VEHICLES.map(s => <option key={s}>{s}</option>)}</optgroup>
      </select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 1.5, color: "#FFD700", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "#111", border: "1px solid #333",
  color: "#fff", borderRadius: 3, fontSize: 13, fontFamily: "inherit",
};

function stampHeader(accent: string): React.CSSProperties {
  return {
    fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 11, letterSpacing: 2,
    color: accent, padding: "8px 10px", border: `2px solid ${accent}`,
    borderLeftWidth: 6, background: "#000", textAlign: "center", fontWeight: 800,
  };
}

function sectionHeader(accent: string): React.CSSProperties {
  return {
    fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 2,
    color: "#000", background: accent, padding: "4px 10px", fontWeight: 800,
    marginTop: 8,
  };
}

function DossierPreview(props: {
  name: string; description: string; faction: { id: string; label: string; color: string };
  role: string; difficulty: string;
  primary: string; secondary: string; throwable: string;
  armor: string; helmet: string;
  stratagems: string[];
}) {
  const { name, description, faction, role, difficulty, primary, secondary, throwable, armor, helmet, stratagems } = props;
  return (
    <div style={{
      border: `2px solid ${faction.color}`, borderRadius: 4, background: "#000",
      boxShadow: `0 0 0 4px #000, 0 0 0 5px ${faction.color}33`,
      overflow: "hidden",
    }}>
      <div style={{
        background: `linear-gradient(90deg, ${faction.color} 0%, ${faction.color}cc 100%)`,
        color: "#000", padding: "10px 14px",
        fontFamily: "ui-monospace,Menlo,Consolas,monospace",
        fontSize: 10, letterSpacing: 2, fontWeight: 800,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>SUPER EARTH // CLASSIFIED</span>
        <span>{faction.label.toUpperCase()}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: 0.5, lineHeight: 1.2 }}>{name}</div>
        {(role || difficulty) && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {role && <Pill color={faction.color}>{role}</Pill>}
            {difficulty && <Pill color="#FFD700">{difficulty}</Pill>}
          </div>
        )}
        {description && <div style={{ marginTop: 10, fontSize: 12, color: "#bbb", fontStyle: "italic", lineHeight: 1.45 }}>"{description}"</div>}

        <div style={dividerStyle(faction.color)}>LOADOUT</div>
        <KV k="Primary"   v={primary} />
        <KV k="Secondary" v={secondary} />
        <KV k="Throwable" v={throwable} />
        <KV k="Armor"     v={armor} />
        {helmet && <KV k="Helmet" v={helmet} />}

        <div style={dividerStyle(faction.color)}>STRATAGEMS</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#fff", fontSize: 12.5, lineHeight: 1.6 }}>
          {stratagems.map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        <div style={{ marginTop: 14, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9, letterSpacing: 1, color: "#666", textAlign: "right" }}>FOR DEMOCRACY.</div>
      </div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      background: color, color: "#000", fontSize: 10, fontWeight: 800,
      letterSpacing: 1, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "3px 0", borderBottom: "1px dashed #222" }}>
      <span style={{ color: "#888", minWidth: 80, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: "#fff" }}>{v}</span>
    </div>
  );
}

function dividerStyle(color: string): React.CSSProperties {
  return {
    fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 2,
    color: color, marginTop: 12, marginBottom: 6, paddingBottom: 2, borderBottom: `1px solid ${color}66`,
    fontWeight: 800,
  };
}
