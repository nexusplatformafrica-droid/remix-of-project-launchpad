import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Link2, DatabaseZap, Radio, CheckCircle2, XCircle, KeyRound, Copy, BookOpen } from "lucide-react";
import { API_TOKEN_KEY, sha256Hex, type ApiTokenSetting } from "@/lib/api-token";
import { getFbAuth } from "@/lib/firebase";
import { createAdminApiToken, refreshApiToken } from "@/lib/api-token.functions";
import { DEFAULT_MOVIE_RELAY, MOVIE_RELAY_KEY, normalizeRelayUrl } from "@/lib/movie-relay";
import { refreshMovieRelay, testMovieRelay, type RelayCheck } from "@/lib/movie-relay.functions";
import {
  DEFAULT_PLANS,
  getSetting,
  saveSetting,
  type EndpointsSetting,
  type PlansSetting,
} from "@/lib/admin";
import { Panel, goldBtn, softField } from "./ui";

const DEFAULT_ENDPOINTS: EndpointsSetting = {
  payment_backend_url: "",
  save_api_content: false,
};

export function SettingsTab() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => getSetting<PlansSetting>("plans", DEFAULT_PLANS) });
  const endQ = useQuery({
    queryKey: ["endpoints"],
    queryFn: () => getSetting<EndpointsSetting>("endpoints", DEFAULT_ENDPOINTS),
  });

  const [plans, setPlans] = useState<PlansSetting>(DEFAULT_PLANS);
  const [end, setEnd] = useState<EndpointsSetting>(DEFAULT_ENDPOINTS);

  useEffect(() => {
    if (plansQ.data) setPlans(plansQ.data);
  }, [plansQ.data]);
  useEffect(() => {
    if (endQ.data) setEnd(endQ.data);
  }, [endQ.data]);

  const savePlans = useMutation({
    mutationFn: () => saveSetting("plans", plans),
    onSuccess: () => {
      toast.success("Subscription prices saved");
      void qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEnd = useMutation({
    mutationFn: () => saveSetting("endpoints", end),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["endpoints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editPlan = (tier: "vip" | "svip", idx: number, patch: Partial<PlansSetting["vip"][number]>) =>
    setPlans((p) => ({
      ...p,
      [tier]: p[tier].map((pl, i) => (i === idx ? { ...pl, ...patch } : pl)),
    }));

  return (
    <div className="space-y-3">
      <MovieRelayPanel />
      <ApiTokenPanel />
      <Panel
        title="Subscription prices"
        action={
          <button type="button" onClick={() => savePlans.mutate()} disabled={savePlans.isPending} className={`${goldBtn} inline-flex items-center gap-2`}>
            <Save className="size-4" /> Save prices
          </button>
        }
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {(["vip", "svip"] as const).map((tier) => (
            <div key={tier}>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide opacity-60">
                {tier === "vip" ? "VIP Member" : "SVIP Member"}
              </p>
              <div className="space-y-2">
                {plans[tier].map((p, i) => (
                  <div key={p.id} className="grid gap-2 rounded-2xl bg-white/65 p-3 sm:grid-cols-[1.2fr_1fr_.7fr_.7fr]">
                    <input className={softField} value={p.name} onChange={(e) => editPlan(tier, i, { name: e.target.value })} placeholder="Plan name" />
                    <input
                      className={softField}
                      inputMode="numeric"
                      value={String(p.price)}
                      onChange={(e) => editPlan(tier, i, { price: Number(e.target.value) || 0 })}
                      placeholder="Price UGX"
                    />
                    <div className="flex gap-1">
                      <input
                        className={softField}
                        inputMode="numeric"
                        value={String(p.hours ? p.hours : p.days)}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 1;
                          editPlan(tier, i, p.hours ? { hours: n } : { days: n });
                        }}
                        placeholder="Length"
                      />
                      <select
                        className={softField}
                        value={p.hours ? "hours" : "days"}
                        onChange={(e) =>
                          editPlan(tier, i, e.target.value === "hours" ? { hours: p.hours || 6 } : { hours: 0, days: p.days || 1 })
                        }
                      >
                        <option value="days">days</option>
                        <option value="hours">hours</option>
                      </select>
                    </div>
                    <input
                      className={softField}
                      inputMode="numeric"
                      title="Devices allowed at the same time"
                      value={String(Number(p.devices ?? 1) || 1)}
                      onChange={(e) => editPlan(tier, i, { devices: Number(e.target.value) || 1 })}
                      placeholder="Devices"
                    />
                    <input
                      className={`${softField} sm:col-span-4`}
                      value={p.note}
                      onChange={(e) => editPlan(tier, i, { note: e.target.value })}
                      placeholder="Short description"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Payments & content sync"
        action={
          <button type="button" onClick={() => saveEnd.mutate()} disabled={saveEnd.isPending} className={`${goldBtn} inline-flex items-center gap-2`}>
            <Save className="size-4" /> Save settings
          </button>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold opacity-70">
              <Link2 className="size-3.5" /> Payment backend URL
            </span>
            <input
              className={softField}
              placeholder="https://pay.example.com/api"
              value={end.payment_backend_url}
              onChange={(e) => setEnd({ ...end, payment_backend_url: e.target.value })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <DatabaseZap className="size-4" /> Save all content from API to the database
            </span>
            <input
              type="checkbox"
              className="size-5 accent-[oklch(0.82_0.1_65)]"
              checked={end.save_api_content}
              onChange={(e) => setEnd({ ...end, save_api_content: e.target.checked })}
            />
          </label>
          <p className="text-[11px] opacity-55">
            Admin uploads use this site's Cloudflare R2 binding. Payment settings are stored here.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/** Admin-editable movie relay address used for playback and downloads. */
function MovieRelayPanel() {
  const qc = useQueryClient();
  const relayQ = useQuery({
    queryKey: ["movie-relay"],
    queryFn: () => getSetting<string>(MOVIE_RELAY_KEY, DEFAULT_MOVIE_RELAY),
  });
  const [url, setUrl] = useState("");
  const [check, setCheck] = useState<RelayCheck | null>(null);
  useEffect(() => {
    if (relayQ.data) setUrl(relayQ.data);
  }, [relayQ.data]);

  const test = useMutation({
    mutationFn: () => testMovieRelay({ data: { url } }),
    onSuccess: (r) => setCheck(r),
    onError: (e: Error) => setCheck({ ok: false, message: e.message }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const clean = normalizeRelayUrl(url);
      if (!clean) throw new Error("Enter a full https:// address.");
      const r = await testMovieRelay({ data: { url: clean } });
      setCheck(r);
      if (!r.ok) throw new Error(r.message);
      await saveSetting(MOVIE_RELAY_KEY, clean);
      await refreshMovieRelay().catch(() => undefined);
      setUrl(clean);
    },
    onSuccess: () => {
      toast.success("Movie relay saved — playback now uses it");
      void qc.invalidateQueries({ queryKey: ["movie-relay"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      title="Movie relay (playback & downloads)"
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending || save.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-current/20 px-4 py-2 text-[13px] font-semibold"
          >
            <Radio className="size-4" /> {test.isPending ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className={`${goldBtn} inline-flex items-center gap-2`}
          >
            <Save className="size-4" /> {save.isPending ? "Saving…" : "Save relay"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold opacity-70">
            <Link2 className="size-3.5" /> Relay address
          </span>
          <input
            className={softField}
            placeholder={DEFAULT_MOVIE_RELAY}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setCheck(null);
            }}
          />
        </label>
        {check && (
          <p className={`flex items-center gap-2 text-[12px] font-semibold ${check.ok ? "text-primary" : "text-destructive"}`}>
            {check.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {check.message}
          </p>
        )}
        <p className="text-[11px] opacity-55">
          Saving tests the address first and only keeps it if MovieBox answers through it. The live site switches within a minute.
        </p>
      </div>
    </Panel>
  );
}

const LOCAL_TOKEN = "moviemax_api_token";

/** One developer API token for every developer using /api/public/v1. */
function ApiTokenPanel() {
  const qc = useQueryClient();
  const tokenQ = useQuery({
    queryKey: ["api-token"],
    queryFn: () => getSetting<ApiTokenSetting | null>(API_TOKEN_KEY, null),
  });
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    const local = localStorage.getItem(LOCAL_TOKEN);
    if (local && tokenQ.data?.last4 && local.endsWith(tokenQ.data.last4)) setShown(local);
  }, [tokenQ.data]);

  const create = useMutation({
    mutationFn: async () => {
      if (tokenQ.data && !window.confirm("Replace the API token? Apps using the old one stop working within a minute.")) {
        throw new Error("cancelled");
      }
      const user = getFbAuth().currentUser;
      if (!user) throw new Error("Please sign in again");
      const made = await createAdminApiToken({ data: { idToken: await user.getIdToken() } });
      if (!made.ok) throw new Error(made.error);
      const token = made.token;
      const value: ApiTokenSetting = { hash: await sha256Hex(token), last4: token.slice(-4), created_at: new Date().toISOString() };
      await saveSetting(API_TOKEN_KEY, value);
      await refreshApiToken().catch(() => undefined);
      localStorage.setItem(LOCAL_TOKEN, token);
      return token;
    },
    onSuccess: (token) => {
      setShown(token);
      toast.success("API token created — copy it and share it with your developers");
      void qc.invalidateQueries({ queryKey: ["api-token"] });
    },
    onError: (e: Error) => e.message !== "cancelled" && toast.error(e.message),
  });

  const copy = async () => {
    if (!shown) return;
    await navigator.clipboard.writeText(shown);
    toast.success("Token copied");
  };

  const t = tokenQ.data;
  return (
    <Panel
      title="Developer API token"
      action={
        <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className={`${goldBtn} inline-flex items-center gap-2`}>
          <KeyRound className="size-4" /> {create.isPending ? "Creating…" : t ? "Replace token" : "Create token"}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] font-semibold">
          {t ? (
            <>Active token ending in <span className="font-mono">…{t.last4}</span> · created {new Date(t.created_at).toLocaleString()}</>
          ) : (
            "No token yet — the developer API is closed until you create one."
          )}
        </p>
        {shown && (
          <div className="flex items-center gap-2 rounded-2xl bg-white/65 p-2">
            <code className="min-w-0 flex-1 break-all px-2 font-mono text-[12px]">{shown}</code>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-current/20 px-3 py-1.5 text-[12px] font-semibold">
              <Copy className="size-3.5" /> Copy
            </button>
          </div>
        )}
        <p className="text-[11px] opacity-55">
          One token for all developers. Only a fingerprint is stored, so the full token shows only on the browser that created it — create a new one if you lose it.{" "}
          <a href="/doc" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold underline">
            <BookOpen className="size-3" /> Developer guide
          </a>
        </p>
      </div>
    </Panel>
  );
}
