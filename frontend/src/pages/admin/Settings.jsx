import React, { useState, useEffect } from "react";
import { Save, School as SchoolIcon, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { PageHeader } from "@/components/common/domain";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";

export default function Settings() {
  const [school, setSchool] = useState(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(null);

  const loadSettings = async () => {
    try {
      const res = await adminApi.school();
      setSchool(res);
      setName(res?.name || "");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      await adminApi.write("settings", { name: name.trim() }, "PATCH");
      setNotice("School configuration updated successfully.");
      loadSettings();
    } catch (err) {
      alert(err?.message || "Failed to update school settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton label="Loading school settings…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadSettings} />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Institutional Settings"
        description="Global configuration for this school tenant."
      />

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
          {notice}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5 text-xs"
      >
        <div>
          <label
            htmlFor="field-school-institution-name"
            className="block font-semibold text-slate-700 mb-1"
          >
            School Institution Name
          </label>
          <input
            id="field-school-institution-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200/70 rounded-lg">
          <div>
            <span className="block text-[11px] font-bold  text-slate-400 font-mono mb-1">
              Sign-in School Code
            </span>
            <span className="font-mono text-sm font-bold text-slate-900 block">
              {school?.slug || "demo"}
            </span>
            <span className="text-[11px] text-slate-400">
              Assigned unique tenant identifier
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-bold  text-slate-400 font-mono mb-1">
              Institutional Email Domain
            </span>
            <span className="font-mono text-sm font-bold text-slate-900 block">
              {school?.domain || "demo.edu"}
            </span>
            <span className="text-[11px] text-slate-400">
              Verified domain for user sign-in
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            <span>{saving ? "Saving…" : "Save School Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
