import { lazy, Suspense } from "react";

const FloatingNotesScene = lazy(() => import("./FloatingNotesScene.jsx"));

export default function LazyFloatingNotesScene(props) {
  return (
    <Suspense fallback={null}>
      <FloatingNotesScene {...props} />
    </Suspense>
  );
}
