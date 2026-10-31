"use client";
// Home-page curtain intro: the wordmark rises letter by letter, a gold rule draws, and the curtain lifts.
// Plays once per browser session. Pure CSS animation (no JS needed to finish it); hidden under reduced motion.
import { useLayoutEffect } from "react";

const KEY = "oryvia-intro-seen";

// Runs during HTML parsing, before first paint, so a returning visitor never sees a flash of the curtain.
const EARLY = `try{if(sessionStorage.getItem("${KEY}"))document.documentElement.dataset.introSeen="1"}catch(e){}`;

export function Intro() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const w = window as typeof window & { __oryviaIntroPlaying?: boolean };
    try {
      // "Playing" guards the effect running twice (React StrictMode) while the curtain is still up.
      if (sessionStorage.getItem(KEY) && !w.__oryviaIntroPlaying) root.dataset.introSeen = "1";
      else if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        w.__oryviaIntroPlaying = true;
        window.setTimeout(() => {
          w.__oryviaIntroPlaying = false;
          // Safety net: if animations were paused (background tab), never leave the curtain over the page.
          root.dataset.introDone = "1";
        }, 2200);
      }
    } catch {
      root.dataset.introSeen = "1"; // storage blocked: skip rather than replay on every visit
    }
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-inner">
          <p className="intro-mark">
            {"ORYVIA".split("").map((c, i) => (
              <span key={i} style={{ animationDelay: `${80 + i * 55}ms` }}>
                {c}
              </span>
            ))}
          </p>
          <span className="intro-rule" />
          <p className="intro-sub">Skincare · Hair care</p>
        </div>
      </div>
    </>
  );
}
