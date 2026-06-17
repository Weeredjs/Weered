"use client";

import React, { useCallback, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#6366F1";
const GREEN = "#22C55E";
const RED = "#EF4444";

interface Question {
  type: "multiple_choice" | "true_false" | "fill_blank";
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
}

type Step = "upload" | "quiz" | "results";
type QuestionType = "mixed" | "multiple_choice" | "true_false";

const S = {
  wrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: 16,
    height: "100%",
    overflowY: "auto" as const,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "rgba(243,244,246,.92)",
  },
  card: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.06)",
    background: "rgba(255,255,255,.03)",
    padding: "16px 18px",
  } as React.CSSProperties,
  heading: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
    color: "rgba(243,244,246,.95)",
  } as React.CSSProperties,
  sub: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 14,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
  pill: (active: boolean) =>
    ({
      padding: "6px 14px",
      borderRadius: 20,
      border: `1px solid ${active ? ACCENT : "rgba(255,255,255,.10)"}`,
      background: active ? `${ACCENT}20` : "rgba(255,255,255,.04)",
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      color: active ? ACCENT : "rgba(243,244,246,.7)",
      transition: "all .15s",
    }) as React.CSSProperties,
  btnPrimary: (disabled?: boolean) =>
    ({
      padding: "10px 24px",
      borderRadius: 10,
      border: "none",
      background: disabled ? "rgba(99,102,241,.3)" : ACCENT,
      fontSize: 14,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      color: "#fff",
      opacity: disabled ? 0.6 : 1,
      transition: "all .15s",
      width: "100%",
    }) as React.CSSProperties,
  btnSecondary: {
    padding: "8px 18px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    color: "rgba(243,244,246,.8)",
    transition: "all .15s",
  } as React.CSSProperties,
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    background: "rgba(255,255,255,.08)",
    overflow: "hidden" as const,
  } as React.CSSProperties,
  progressFill: (pct: number) =>
    ({
      width: `${pct}%`,
      height: "100%",
      background: ACCENT,
      borderRadius: 2,
      transition: "width .3s ease",
    }) as React.CSSProperties,
  optionCard: (state: "default" | "selected" | "correct" | "wrong") => {
    const border =
      state === "correct"
        ? GREEN
        : state === "wrong"
          ? RED
          : state === "selected"
            ? ACCENT
            : "rgba(255,255,255,.10)";
    const bg =
      state === "correct"
        ? `${GREEN}12`
        : state === "wrong"
          ? `${RED}12`
          : state === "selected"
            ? `${ACCENT}12`
            : "rgba(255,255,255,.03)";
    return {
      padding: "12px 16px",
      borderRadius: 10,
      border: `1.5px solid ${border}`,
      background: bg,
      cursor: state === "default" || state === "selected" ? "pointer" : "default",
      display: "flex",
      alignItems: "center",
      gap: 12,
      transition: "all .2s ease",
      animation:
        state === "correct"
          ? "correctPulse .5s ease"
          : state === "wrong"
            ? "wrongPulse .5s ease"
            : "none",
    } as React.CSSProperties;
  },
  optionLabel: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(255,255,255,.06)",
    color: "rgba(243,244,246,.7)",
    flexShrink: 0,
  } as React.CSSProperties,
  scoreRing: {
    position: "relative" as const,
    width: 140,
    height: 140,
    margin: "0 auto",
  } as React.CSSProperties,
  charCount: {
    fontSize: 11,
    opacity: 0.35,
    textAlign: "right" as const,
    marginTop: 4,
  } as React.CSSProperties,
  fileBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: `1px dashed rgba(255,255,255,.15)`,
    background: "rgba(255,255,255,.02)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.6)",
    transition: "all .15s",
  } as React.CSSProperties,
  explanationBox: (correct: boolean) =>
    ({
      padding: "10px 14px",
      borderRadius: 8,
      background: correct ? `${GREEN}08` : `${RED}08`,
      border: `1px solid ${correct ? GREEN : RED}20`,
      fontSize: 12,
      lineHeight: 1.5,
      color: "rgba(243,244,246,.8)",
      marginTop: 10,
    }) as React.CSSProperties,
  loadingDots: {
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
  } as React.CSSProperties,
  resultRow: (correct: boolean) =>
    ({
      padding: "10px 14px",
      borderRadius: 8,
      border: `1px solid ${correct ? GREEN : RED}25`,
      background: correct ? `${GREEN}06` : `${RED}06`,
      cursor: "pointer",
      transition: "all .15s",
    }) as React.CSSProperties,
};

const KEYFRAMES_ID = "study-quiz-keyframes";
function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes correctPulse {
      0% { box-shadow: 0 0 0 0 rgba(34,197,94,.4); }
      50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
      100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    }
    @keyframes wrongPulse {
      0% { box-shadow: 0 0 0 0 rgba(239,68,68,.3); }
      50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }
    @keyframes dotBounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scoreReveal {
      from { stroke-dashoffset: 377; }
    }
  `;
  document.head.appendChild(style);
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const circumference = 2 * Math.PI * 60;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.8 ? GREEN : pct >= 0.5 ? "#F59E0B" : RED;

  return (
    <div style={S.scoreRing}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{
            transition: "stroke-dashoffset 1s ease",
            animation: "scoreReveal 1s ease forwards",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{score}</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>of {total}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 2 }}>
          {Math.round(pct * 100)}%
        </div>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={S.loadingDots}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ACCENT,
            animation: `dotBounce .6s ease infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}

export default function StudyQuiz() {
  ensureKeyframes();

  const [step, setStep] = useState<Step>("upload");
  const [content, setContent] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [questionType, setQuestionType] = useState<QuestionType>("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [results, setResults] = useState<boolean[]>([]);

  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const currentQ = questions[currentIdx] || null;
  const isLastQuestion = currentIdx === questions.length - 1;

  const getSelectedForCheck = useCallback(() => {
    if (!currentQ) return null;
    if (currentQ.type === "fill_blank") return fillAnswer.trim();
    return selectedAnswer;
  }, [currentQ, fillAnswer, selectedAnswer]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) setContent(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const generateQuiz = useCallback(async () => {
    if (content.trim().length < 50) {
      setError("Please provide at least 50 characters of study content.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const token =
        typeof localStorage !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
      const res = await fetch(`${API}/ai/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: content.trim(),
          numQuestions,
          questionTypes: questionType,
        }),
      });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        setError(data.error || "Failed to generate quiz. Try different content.");
        return;
      }

      setQuestions(data.questions);
      setCurrentIdx(0);
      setSelectedAnswer(null);
      setFillAnswer("");
      setChecked(false);
      setAnswers(new Array(data.questions.length).fill(null));
      setResults(new Array(data.questions.length).fill(false));
      setStep("quiz");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [content, numQuestions, questionType]);

  const checkAnswer = useCallback(() => {
    if (!currentQ) return;
    const given = getSelectedForCheck();
    if (!given) return;

    const correct = currentQ.answer.trim().toLowerCase();
    const isCorrect = given.toLowerCase() === correct;

    setChecked(true);
    setAnswers((prev) => {
      const n = [...prev];
      n[currentIdx] = given;
      return n;
    });
    setResults((prev) => {
      const n = [...prev];
      n[currentIdx] = isCorrect;
      return n;
    });
  }, [currentQ, currentIdx, getSelectedForCheck]);

  const nextQuestion = useCallback(() => {
    if (isLastQuestion) {
      setStep("results");
      return;
    }
    setCurrentIdx((i) => i + 1);
    setSelectedAnswer(null);
    setFillAnswer("");
    setChecked(false);
  }, [isLastQuestion]);

  const retryQuiz = useCallback(() => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setFillAnswer("");
    setChecked(false);
    setAnswers(new Array(shuffled.length).fill(null));
    setResults(new Array(shuffled.length).fill(false));
    setStep("quiz");
  }, [questions]);

  const newQuiz = useCallback(() => {
    setStep("upload");
    setContent("");
    setQuestions([]);
    setError("");
  }, []);

  const getOptionState = (option: string): "default" | "selected" | "correct" | "wrong" => {
    if (!checked) return selectedAnswer === option ? "selected" : "default";
    const isCorrectAnswer = option.toLowerCase() === currentQ?.answer.trim().toLowerCase();
    if (isCorrectAnswer) return "correct";
    if (selectedAnswer === option) return "wrong";
    return "default";
  };

  const OPTION_LABELS = ["A", "B", "C", "D"];
  const NUM_OPTIONS = [5, 10, 15, 20];
  const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
    { value: "mixed", label: "Mixed" },
    { value: "multiple_choice", label: "Multiple Choice" },
    { value: "true_false", label: "True / False" },
  ];

  const score = results.filter(Boolean).length;

  if (step === "upload") {
    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.heading}>Practice Test Generator</div>
          <div style={S.sub}>Paste study material and let AI create a quiz for you</div>

          <textarea
            style={S.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your study notes, textbook excerpt, or lecture notes..."
            spellCheck={false}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <div style={S.charCount}>{content.length.toLocaleString()} characters</div>
            <button style={S.fileBtn} onClick={() => fileRef.current?.click()}>
              Upload .txt file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.text"
              style={{ display: "none" }}
              onChange={handleFile}
            />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Number of Questions</div>
          <div style={{ display: "flex", gap: 8 }}>
            {NUM_OPTIONS.map((n) => (
              <button key={n} style={S.pill(numQuestions === n)} onClick={() => setNumQuestions(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Question Type</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                style={S.pill(questionType === t.value)}
                onClick={() => setQuestionType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: RED,
              padding: "8px 12px",
              borderRadius: 8,
              background: `${RED}10`,
            }}
          >
            {error}
          </div>
        )}

        <button
          style={S.btnPrimary(loading || content.trim().length < 50)}
          disabled={loading || content.trim().length < 50}
          onClick={generateQuiz}
        >
          {loading ? (
            <span
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              Generating your practice test <LoadingDots />
            </span>
          ) : (
            "Generate Quiz"
          )}
        </button>
      </div>
    );
  }

  if (step === "quiz" && currentQ) {
    const progress = ((currentIdx + (checked ? 1 : 0)) / questions.length) * 100;
    const canCheck =
      currentQ.type === "fill_blank" ? fillAnswer.trim().length > 0 : selectedAnswer !== null;

    return (
      <div style={{ ...S.wrap, animation: "fadeIn .3s ease" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span style={{ fontSize: 11, opacity: 0.4 }}>
              {currentQ.type === "multiple_choice"
                ? "Multiple Choice"
                : currentQ.type === "true_false"
                  ? "True / False"
                  : "Fill in the Blank"}
            </span>
          </div>
          <div style={S.progressBar}>
            <div style={S.progressFill(progress)} />
          </div>
        </div>

        <div style={{ ...S.card, paddingTop: 20, paddingBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>{currentQ.question}</div>
        </div>

        {currentQ.type === "fill_blank" ? (
          <div>
            <input
              type="text"
              value={fillAnswer}
              onChange={(e) => !checked && setFillAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !checked && fillAnswer.trim()) checkAnswer();
              }}
              placeholder="Type your answer..."
              disabled={checked}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: `1.5px solid ${
                  checked
                    ? results[currentIdx]
                      ? GREEN
                      : RED
                    : fillAnswer
                      ? ACCENT
                      : "rgba(255,255,255,.10)"
                }`,
                background: checked
                  ? results[currentIdx]
                    ? `${GREEN}08`
                    : `${RED}08`
                  : "rgba(0,0,0,.30)",
                fontSize: 14,
                color: "rgba(243,244,246,.92)",
                outline: "none",
                boxSizing: "border-box",
                transition: "all .2s",
              }}
            />
            {checked && !results[currentIdx] && (
              <div style={{ fontSize: 12, marginTop: 6, color: GREEN }}>
                Correct answer: {currentQ.answer}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(currentQ.options || []).map((opt, i) => (
              <div
                key={i}
                style={S.optionCard(getOptionState(opt))}
                onClick={() => {
                  if (!checked) setSelectedAnswer(opt);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!checked) setSelectedAnswer(opt);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <div
                  style={{
                    ...S.optionLabel,
                    ...(getOptionState(opt) === "correct"
                      ? { background: `${GREEN}20`, color: GREEN }
                      : getOptionState(opt) === "wrong"
                        ? { background: `${RED}20`, color: RED }
                        : getOptionState(opt) === "selected"
                          ? { background: `${ACCENT}20`, color: ACCENT }
                          : {}),
                  }}
                >
                  {getOptionState(opt) === "correct"
                    ? "\u2713"
                    : getOptionState(opt) === "wrong"
                      ? "\u2717"
                      : OPTION_LABELS[i] || String(i + 1)}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, flex: 1 }}>{opt}</div>
              </div>
            ))}
          </div>
        )}

        {checked && currentQ.explanation && (
          <div style={S.explanationBox(results[currentIdx])}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 4,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              {results[currentIdx] ? "Correct!" : "Not quite"}
            </div>
            {currentQ.explanation}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {!checked ? (
            <button style={S.btnPrimary(!canCheck)} disabled={!canCheck} onClick={checkAnswer}>
              Check Answer
            </button>
          ) : (
            <button style={S.btnPrimary(false)} onClick={nextQuestion}>
              {isLastQuestion ? "See Results" : "Next Question"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "results") {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const encouragement =
      pct >= 90
        ? "Outstanding work!"
        : pct >= 70
          ? "Great job! Keep studying to master it."
          : pct >= 50
            ? "Good effort. Review the ones you missed."
            : "Keep at it! Review the material and try again.";

    return (
      <div style={{ ...S.wrap, animation: "fadeIn .4s ease" }}>
        <div style={{ ...S.card, textAlign: "center", paddingTop: 24, paddingBottom: 24 }}>
          <ScoreRing score={score} total={questions.length} />
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>{encouragement}</div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Question Review</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {questions.map((q, i) => (
              <div key={i}>
                <div
                  style={S.resultRow(results[i])}
                  onClick={() => setExpandedResult(expandedResult === i ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedResult(expandedResult === i ? null : i);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        background: results[i] ? `${GREEN}20` : `${RED}20`,
                        color: results[i] ? GREEN : RED,
                      }}
                    >
                      {results[i] ? "\u2713" : "\u2717"}
                    </span>
                    <span style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>
                      {q.question.length > 80 ? q.question.slice(0, 80) + "..." : q.question}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.4,
                        transform: expandedResult === i ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform .2s",
                      }}
                    >
                      {"\u25BC"}
                    </span>
                  </div>
                </div>
                {expandedResult === i && (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "rgba(0,0,0,.15)",
                      borderRadius: "0 0 8px 8px",
                      marginTop: -1,
                      border: "1px solid rgba(255,255,255,.04)",
                      borderTop: "none",
                      animation: "fadeIn .2s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
                      Your answer:{" "}
                      <span style={{ color: results[i] ? GREEN : RED, fontWeight: 600 }}>
                        {answers[i] || "(no answer)"}
                      </span>
                    </div>
                    {!results[i] && (
                      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
                        Correct answer:{" "}
                        <span style={{ color: GREEN, fontWeight: 600 }}>{q.answer}</span>
                      </div>
                    )}
                    {q.explanation && (
                      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginTop: 4 }}>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnSecondary} onClick={retryQuiz}>
            Try Again
          </button>
          <button style={{ ...S.btnPrimary(false), flex: 1 }} onClick={newQuiz}>
            New Quiz
          </button>
        </div>
      </div>
    );
  }

  return null;
}
