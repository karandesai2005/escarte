import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import Foxy from "@/components/Foxy";
import ChunkyButton from "@/components/ChunkyButton";
import { toast } from "sonner";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";

const CATEGORY_LABELS = {
  english: "English",
  communication: "Communication",
  finance: "Finance",
  leadership: "Leadership",
  critical: "Critical Thinking",
  emotional: "Emotional IQ",
};

export default function Results() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sub, setSub] = useState(null);
  const [badges, setBadges] = useState({});
  const reportRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, b] = await Promise.all([api.get(`/submissions/${id}`), api.get("/badges")]);
        setSub(s.data);
        setBadges(b.data);
      } catch (e) {
        toast.error("Couldn't load report");
        nav("/dashboard");
      }
    })();
  }, [id, nav]);

  if (!sub) return <div className="min-h-screen flex items-center justify-center"><Foxy size={100} /></div>;

  const chartData = Object.entries(sub.per_category).map(([cat, s]) => ({
    subject: CATEGORY_LABELS[cat] || cat,
    score: s.max_points ? Math.round((s.points / s.max_points) * 100) : 0,
  }));

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40; let y = 50;
    doc.setFillColor(255, 130, 45); doc.rect(0, 0, 595, 90, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(26); doc.text("Escarté Report 🦊", marginX, 55);
    doc.setFontSize(11); doc.text(`Rank: ${sub.rank}  •  Score: ${sub.score_pct}%`, marginX, 75);
    y = 120;
    doc.setTextColor(30, 41, 59); doc.setFontSize(14);
    doc.text(`Correct: ${sub.correct_count} / ${sub.total_questions}`, marginX, y); y += 24;
    doc.setFontSize(13); doc.text("Category Scores:", marginX, y); y += 18;
    doc.setFontSize(11);
    chartData.forEach((c) => { doc.text(`• ${c.subject}: ${c.score}%`, marginX + 10, y); y += 16; });
    y += 8;
    doc.setFontSize(13); doc.text("What you rock at:", marginX, y); y += 18; doc.setFontSize(11);
    (sub.pros || []).forEach((p) => { const lines = doc.splitTextToSize(`+ ${p.text}`, 500); doc.text(lines, marginX + 10, y); y += 16 * lines.length; });
    y += 6;
    doc.setFontSize(13); doc.text("Level up next:", marginX, y); y += 18; doc.setFontSize(11);
    (sub.cons || []).forEach((p) => { const lines = doc.splitTextToSize(`- ${p.text}`, 500); doc.text(lines, marginX + 10, y); y += 16 * lines.length; });
    y += 6;
    doc.setFontSize(13); doc.text("Foxy's Recommendations:", marginX, y); y += 18; doc.setFontSize(11);
    (sub.recommendations || []).forEach((p) => { const lines = doc.splitTextToSize(`→ ${p.text}`, 500); doc.text(lines, marginX + 10, y); y += 16 * lines.length; });

    doc.save(`Escarté-Report-${sub.id.slice(0, 6)}.pdf`);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "My Escarté Report", text: `I scored ${sub.score_pct}% — ${sub.rank}!`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  return (
    <div className="min-h-screen bg-parchment pb-16" data-testid="results-page">
      {/* Hero band */}
      <div className="bg-gradient-to-br from-[#1A2A4F] to-[#E5A934] text-white">
        <div className="max-w-3xl mx-auto px-5 py-8 flex items-center gap-5">
          <Foxy mood="cheer" size={120} className="animate-pop" />
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-90">Your rank</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold" data-testid="rank-title">{sub.rank}</h1>
            <div className="mt-1 text-lg font-bold" data-testid="score-pct">{sub.score_pct}% • {sub.correct_count}/{sub.total_questions} correct</div>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="max-w-3xl mx-auto px-5 -mt-6">
        {/* Radar chart */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 shadow-[0_6px_0_0_rgba(226,232,240,1)]">
          <h2 className="font-display text-xl font-bold text-slate-800 mb-3">Your Skill Radar</h2>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#1A2A4F", fontSize: 12, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 10 }} />
                <Radar name="Score" dataKey="score" stroke="#1A2A4F" fill="#1A2A4F" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Badges */}
        {sub.badges_earned?.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 mt-4 shadow-[0_6px_0_0_rgba(226,232,240,1)]">
            <h2 className="font-display text-xl font-bold text-slate-800 mb-3">Badges unlocked 🏆</h2>
            <div className="flex flex-wrap gap-3">
              {sub.badges_earned.map((b) => (
                <div key={b} data-testid={`result-badge-${b}`} className="bg-[#F5EFE0] border-2 border-[#1A2A4F] rounded-2xl px-4 py-3 text-center animate-pop">
                  <div className="text-3xl">{badges[b]?.emoji || "🎖️"}</div>
                  <div className="text-sm font-bold text-[#0F1B37]">{badges[b]?.name || b}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reflections (honest categories) */}
        {sub.reflections?.length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-[#E5A934] p-5 mt-4 shadow-[0_6px_0_0_rgba(229,169,52,0.35)]">
            <h2 className="font-display text-xl font-bold text-[#1A2A4F] mb-3">Your Reflections ✨</h2>
            <p className="text-xs uppercase tracking-widest text-[#B71C1C] mb-3">No right or wrong — just you.</p>
            <ul className="space-y-2">
              {sub.reflections.map((r, i) => (
                <li key={i} data-testid={`reflection-${r.category}`} className="flex gap-3 items-start bg-[#FFF8EA] rounded-xl p-3">
                  <span className="text-lg">✨</span>
                  <div>
                    <div className="text-xs font-bold uppercase text-[#B78522]">{CATEGORY_LABELS[r.category]}</div>
                    <div className="text-sm text-slate-700 mt-0.5">{r.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pros */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 mt-4 shadow-[0_6px_0_0_rgba(226,232,240,1)]">
          <h2 className="font-display text-xl font-bold text-slate-800 mb-3">What you rock at 🌟</h2>
          {sub.pros?.length ? (
            <ul className="space-y-2">
              {sub.pros.map((p, i) => (
                <li key={i} data-testid={`pro-${p.category}`} className="flex gap-3 items-start bg-[#E8F5E9] rounded-xl p-3">
                  <span className="text-lg">✅</span>
                  <div>
                    <div className="text-xs font-bold uppercase text-[#2E7D32]">{CATEGORY_LABELS[p.category]} — {p.score}%</div>
                    <div className="text-sm text-slate-700">{p.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Practice a bit more to spot your strengths — you've got this!</p>
          )}
        </div>

        {/* Cons */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 mt-4 shadow-[0_6px_0_0_rgba(226,232,240,1)]">
          <h2 className="font-display text-xl font-bold text-slate-800 mb-3">Level up next 🚀</h2>
          {sub.cons?.length ? (
            <ul className="space-y-2">
              {sub.cons.map((p, i) => (
                <li key={i} data-testid={`con-${p.category}`} className="flex gap-3 items-start bg-[#F5EFE0] rounded-xl p-3">
                  <span className="text-lg">💡</span>
                  <div>
                    <div className="text-xs font-bold uppercase text-[#0F1B37]">{CATEGORY_LABELS[p.category]} — {p.score}%</div>
                    <div className="text-sm text-slate-700">{p.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">You crushed everything! Try again for badges. 🏆</p>
          )}
        </div>

        {/* Recommendations */}
        {sub.recommendations?.length > 0 && (
          <div className="rounded-3xl border-2 border-[#1A2A4F] bg-[#F5EFE0] p-5 mt-4 shadow-[0_6px_0_0_rgba(255,130,45,0.25)]">
            <h2 className="font-display text-xl font-bold text-slate-800 mb-3">Foxy's picks for you 🦊</h2>
            <ul className="space-y-2">
              {sub.recommendations.map((p, i) => (
                <li key={i} className="flex gap-3 items-start bg-white rounded-xl p-3">
                  <span className="text-lg">→</span>
                  <div className="text-sm text-slate-700">{p.text}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ChunkyButton data-testid="download-pdf-btn" variant="orange" onClick={downloadPdf}>Download PDF</ChunkyButton>
          <ChunkyButton data-testid="share-btn" variant="secondary" onClick={share}>Share</ChunkyButton>
          <Link to="/dashboard"><ChunkyButton data-testid="back-dashboard-btn" variant="primary">Back home</ChunkyButton></Link>
        </div>
      </div>
    </div>
  );
}
