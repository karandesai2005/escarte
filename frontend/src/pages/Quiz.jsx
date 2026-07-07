import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Foxy from "@/components/Foxy";
import FoxyBubble from "@/components/FoxyBubble";
import ChunkyButton from "@/components/ChunkyButton";
import QuestionCard from "@/components/QuestionCard";
import FireStreak from "@/components/FireStreak";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { playSound } from "@/lib/sounds";

export default function Quiz() {
  const { category } = useParams(); // "full" or category id
  const nav = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // {question_id, correct, points, max_points, badge, category}
  const [feedback, setFeedback] = useState(null); // { correct, explanation, badge }
  const [intro, setIntro] = useState(0); // 0..2 intro bubbles, 3 = quiz
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = category === "full" ? "/questions" : `/questions/${category}`;
        const { data } = await api.get(url);
        setQuestions(data);
      } catch (e) {
        toast.error("Couldn't load questions");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [category, nav]);

  const q = questions[idx];
  const progress = questions.length ? Math.round((idx / questions.length) * 100) : 0;

  const submitAnswer = async (answer) => {
    if (!q || feedback) return;
    try {
      const { data } = await api.post("/questions/check", {
        question_id: q.id, answer,
      });
      setFeedback(data);
      const honest = !!data.honest;
      if (honest) {
        // No right/wrong for character categories — quiet reflection.
        // No streak, no confetti, no error sound.
      } else if (data.correct) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        playSound("confetti");
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 }, colors: ["#E5A934", "#B71C1C", "#1A2A4F"] });
        if (newStreak >= 2) {
          setTimeout(() => playSound("fire", { maxDuration: 1200 }), 250);
        }
      } else {
        setStreak(0);
        playSound("error");
      }
      setAnswers((prev) => [
        ...prev,
        {
          question_id: q.id,
          category: q.category,
          correct: data.correct,
          points: data.points,
          max_points: q.points,
          badge: data.correct ? data.badge : null,
          format: q.format,
        },
      ]);
    } catch (e) {
      toast.error("Couldn't check answer");
    }
  };

  const next = async () => {
    setFeedback(null);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      // Submit
      setSubmitting(true);
      try {
        const { data } = await api.post("/submissions", {
          category: category === "full" ? null : category,
          answers,
        });
        // Big confetti finish
        playSound("confetti");
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        nav(`/results/${data.id}`);
      } catch (e) {
        toast.error("Couldn't save results");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Foxy size={100} /></div>;

  // Intro bubbles (3 steps)
  if (intro < 3) {
    const bubbles = [
      "Hi! I'm Foxy 🦊 I'll be with you every question.",
      "Answer honestly — this is not a test. It's a fun way to see where you shine!",
      "Ready? Let's go — I'll cheer for you the whole way! 💪",
    ];
    return (
      <div className="min-h-screen bg-parchment flex flex-col justify-center items-center px-5" data-testid="quiz-intro">
        <div className="max-w-md w-full">
          <FoxyBubble mood={intro === 2 ? "cheer" : "happy"} text={bubbles[intro]} size={140} />
          <div className="mt-8">
            <ChunkyButton data-testid="intro-next-btn" variant="orange" onClick={() => setIntro(intro + 1)}>
              {intro < 2 ? "Got it" : "Let's start!"}
            </ChunkyButton>
          </div>
          <div className="text-center mt-4 text-xs text-slate-500">Step {intro + 1} of 3</div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const isHonest = !!(feedback?.honest) || !!(q?.honest);
  const foxyMood = feedback
    ? (feedback.honest ? "thinking" : feedback.correct ? "cheer" : "sad")
    : (isHonest ? "focused" : streak >= 2 ? "focused" : "thinking");
  const foxyText = feedback
    ? feedback.honest
      ? "Noted. Your honest answer counts."
      : feedback.correct
        ? streak >= 3 ? `${streak} in a row — you're on fire! 🔥` : "Nailed it! 🎉"
        : "Aww, so close!"
    : isHonest
      ? "No right or wrong here — just be honest."
      : streak >= 2 ? `Streak of ${streak}! Keep it going.` : "Take your time — you've got this.";

  return (
    <div className="min-h-screen bg-parchment" data-testid="quiz-page">
      {/* Top progress */}
      <div className="max-w-2xl mx-auto px-5 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/dashboard")} className="text-[#1A2A4F] font-bold text-xl" data-testid="quiz-exit-btn">✕</button>
          <div className="flex-1 h-3 bg-[#D9CDB0] rounded-full overflow-hidden border border-[#1A2A4F]/20" data-testid="progress-bar">
            <div className="h-full bg-gradient-to-r from-[#1A2A4F] to-[#B71C1C] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-sm font-bold text-[#1A2A4F]" data-testid="progress-text">{idx + 1}/{questions.length}</div>
          {streak > 0 && (
            <div className="animate-pop" data-testid="streak-badge">
              <FireStreak count={streak} size={32} />
            </div>
          )}
        </div>
      </div>

      {/* Foxy row */}
      <div className="max-w-2xl mx-auto px-5 pt-6">
        <FoxyBubble mood={foxyMood} text={foxyText} size={90} />
      </div>

      {/* Question */}
      <div className="max-w-2xl mx-auto px-5 py-5">
        {!feedback && <QuestionCard question={q} onSubmit={submitAnswer} />}

        {feedback && (
          <div
            className={`rounded-3xl p-5 border-2 shadow-[0_6px_0_0_rgba(226,232,240,1)] ${feedback.honest ? "bg-[#FFF8EA] border-[#E5A934]" : feedback.correct ? "bg-[#EAF3EE] border-[#2D6A4F]" : "bg-[#F5E4E1] border-[#B71C1C]"} animate-float-up`}
            data-testid="feedback-panel"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{feedback.honest ? "✨" : feedback.correct ? "✅" : "❌"}</span>
              <div
                className="font-display text-xl font-bold"
                style={{ color: feedback.honest ? "#B78522" : feedback.correct ? "#2E7D32" : "#C62828" }}
              >
                {feedback.honest ? "Noted" : feedback.correct ? "Correct!" : "Not quite"}
              </div>
              {!feedback.honest && feedback.correct && feedback.badge && (
                <span className="ml-auto bg-white border-2 border-[#E5A934] text-[#0F1B37] rounded-full px-3 py-1 text-xs font-bold animate-pop" data-testid="badge-earned">
                  🏆 Badge unlocked!
                </span>
              )}
            </div>
            <p className="text-slate-700 text-sm sm:text-base leading-snug">{feedback.explanation}</p>
            <div className="mt-4">
              <ChunkyButton
                data-testid="next-question-btn"
                variant={feedback.honest ? "gold" : feedback.correct ? "primary" : "orange"}
                onClick={next}
                disabled={submitting}
              >
                {submitting ? "Wrapping up..." : idx + 1 < questions.length ? "Continue" : "See my results 🎉"}
              </ChunkyButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
