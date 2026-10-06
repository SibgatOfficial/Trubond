export const BRANCHES = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "CSD", label: "Computer Science & Design" },
  { value: "ECE", label: "Electronics & Communication" },
  { value: "EEE", label: "Electrical & Electronics" },
  { value: "MECH", label: "Mechanical Engineering" },
  { value: "CIVIL", label: "Civil Engineering" },
] as const;

export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/chat", label: "Chat", icon: "chat" },

  { href: "/events", label: "Events", icon: "event" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
] as const;

/** Semester options shared by note creation and filtering. */
export const SEMESTERS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"] as const;

export type NoteSortOption = "recent" | "top" | "downloads";

export const APP_NAME = "Trubond";
export const APP_TAGLINE = "College Networking App";
