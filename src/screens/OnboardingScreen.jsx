import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton } from "../components/PrimaryButton";

const SLIDES = [
  { title: "Huddle", subtitle: "Your collaborative workspace for seamless teamwork.", isCover: true },
  {
    title: "Effortless team collaboration, built for remote speed.",
    subtitle: "Connect with your workspace, share ideas in channels, and keep the team aligned in real time.",
  },
  {
    title: "Your remote team, always in reach.",
    subtitle: "Stay connected and collaborate in channels right from your browser.",
  },
  {
    title: "Lightweight chat for fast-moving teams.",
    subtitle: "No bloat, no clutter. Just clean channel messaging built to keep your projects moving forward.",
  },
];

export function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className="flex-1 flex items-end justify-center p-8 min-h-[260px]"
        style={{ background: "linear-gradient(160deg, var(--color-primary), #8fd0f5)" }}
      >
        {slide.isCover && (
          <div className="text-center pb-10">
            <h1 className="text-white text-4xl font-bold font-heading">Huddle</h1>
            <p className="text-white/90 mt-2 max-w-xs mx-auto">{slide.subtitle}</p>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-t-3xl -mt-6 flex flex-col gap-6">
        {!slide.isCover && (
          <div className="flex gap-1.5">
            {SLIDES.slice(1).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index - 1 ? 24 : 8,
                  background: i === index - 1 ? "var(--color-primary)" : "var(--color-border)",
                }}
              />
            ))}
          </div>
        )}

        {!slide.isCover && (
          <div>
            <h2 className="text-2xl font-bold font-heading text-ink">{slide.title}</h2>
            <p className="mt-2 text-slate">{slide.subtitle}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-auto">
          <PrimaryButton
            onClick={() => (isLast ? navigate("/auth?mode=signup") : setIndex(index + 1))}
          >
            {slide.isCover ? "Continue" : isLast ? "Create an account" : "Continue"}
          </PrimaryButton>
          {!slide.isCover && (
            <button onClick={() => navigate("/auth?mode=login")} className="text-sm text-center text-slate">
              Have an account? <span className="text-primary font-semibold">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
