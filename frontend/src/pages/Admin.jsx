import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Foxy from "@/components/Foxy";
import ChunkyButton from "@/components/ChunkyButton";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Admin() {
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role !== "admin") { nav("/dashboard"); return; }
    (async () => {
      try {
        const [a, u, s] = await Promise.all([
          api.get("/admin/analytics"), api.get("/admin/users"), api.get("/admin/submissions"),
        ]);
        setAnalytics(a.data); setUsers(u.data); setSubs(s.data);
      } catch (e) { toast.error("Couldn't load admin data"); }
    })();
  }, [user, ready, nav]);

  const exportLeads = () => {
    const csv = ["name,email,age,grade,created_at"]
      .concat(users.filter(u => u.role === "user").map(u => `"${u.name || ""}","${u.email}","${u.age || ""}","${u.grade || ""}","${u.created_at || ""}"`))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "skillspark-leads.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-parchment" data-testid="admin-page">
      <header className="bg-[#FFF8EA] border-b-2 border-[#D9CDB0]">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <Foxy size={40} />
            <div>
              <span className="font-display text-xl font-bold text-[#1A2A4F]">Escarté</span>
              <span className="ml-2 text-xs font-bold uppercase tracking-widest text-[#B71C1C]">Admin</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-[#F5EFE0] text-[#1A2A4F] font-bold px-3 py-1 rounded-full">ADMIN</span>
            <Link to="/dashboard" className="text-sm font-bold text-slate-600">Exit</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {["overview", "users", "submissions"].map((t) => (
            <button
              key={t}
              data-testid={`admin-tab-${t}`}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full font-bold text-sm uppercase ${tab === t ? "bg-[#1A2A4F] text-white" : "bg-white border-2 border-slate-200 text-slate-600"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Users" value={analytics.user_count} />
              <StatCard label="Total Submissions" value={analytics.submission_count} />
            </div>
            <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
              <h3 className="font-display text-xl font-bold text-slate-800 mb-3">Category Performance</h3>
              <div className="space-y-2">
                {analytics.category_stats.map((c) => (
                  <div key={c.category} data-testid={`analytics-${c.category}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-800 capitalize">{c.category}</div>
                      <div className="text-xs text-slate-500">{c.attempts} attempts</div>
                    </div>
                    <div className="font-display text-2xl font-bold text-[#1A2A4F]">{c.avg_score_pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-bold text-slate-800">All Users ({users.length})</h3>
              <ChunkyButton data-testid="export-leads-btn" variant="orange" className="!w-auto !py-2 !px-4 !text-sm" onClick={exportLeads}>Export CSV</ChunkyButton>
            </div>
            <div className="divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{u.name} {u.role === "admin" && <span className="text-xs text-[#1A2A4F]">(admin)</span>}</div>
                    <div className="text-xs text-slate-500">{u.email} • Age {u.age || "-"} • Grade {u.grade || "-"}</div>
                  </div>
                  <div className="text-xs text-slate-400">{(u.badges || []).length} badges • {u.submission_count || 0} attempts{u.last_login_at && <> • last login {new Date(u.last_login_at).toLocaleDateString()}</>}{u.last_attempt_at && <> • last test {new Date(u.last_attempt_at).toLocaleDateString()}</>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "submissions" && (
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
            <h3 className="font-display text-xl font-bold text-slate-800 mb-3">All Submissions ({subs.length})</h3>
            <div className="divide-y divide-slate-100">
              {subs.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{s.category || "Full Test"}</div>
                    <div className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold text-[#1A2A4F]">{s.score_pct}%</div>
                    <div className="text-xs text-slate-500">{s.rank}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 shadow-[0_6px_0_0_rgba(226,232,240,1)]">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="font-display text-4xl font-bold text-[#1A2A4F] mt-1">{value}</div>
    </div>
  );
}
