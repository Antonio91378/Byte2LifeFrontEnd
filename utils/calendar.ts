import { useEffect, useState } from "react";

export const COMPACT_CALENDAR_MEDIA_QUERY = "(max-width: 640px)";

export function useCompactCalendarMode() {
  const [isCompactCalendar, setIsCompactCalendar] = useState(false);

  useEffect(() => {
    const activeWindow = globalThis.window;
    if (!activeWindow) return undefined;

    const mediaQuery = activeWindow.matchMedia(COMPACT_CALENDAR_MEDIA_QUERY);
    const syncViewport = () => setIsCompactCalendar(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  return isCompactCalendar;
}

export function getResponsiveCalendarConfig(isCompactCalendar: boolean) {
  return {
    wrapperClassName: isCompactCalendar
      ? "schedule-calendar schedule-calendar--compact"
      : "schedule-calendar",
    initialView: isCompactCalendar ? "timeGridDay" : "timeGridWeek",
    headerToolbar: isCompactCalendar
      ? {
          left: "prev,next",
          center: "title",
          right: "today timeGridDay,timeGridWeek",
        }
      : {
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,timeGridDay",
        },
    buttonText: isCompactCalendar
      ? { today: "hoje", week: "sem", day: "dia" }
      : undefined,
    titleFormat: isCompactCalendar
      ? ({ month: "short", day: "numeric" } as const)
      : undefined,
    dayHeaderFormat: isCompactCalendar
      ? ({ weekday: "narrow", day: "numeric" } as const)
      : undefined,
  };
}
